/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as ws from 'ws';
import * as url from 'url';
import * as http from 'http';
import * as https from 'https';
import { injectable, inject, named, postConstruct } from 'inversify';
import { MessageConnection } from 'vscode-jsonrpc';
import { createWebSocketConnection } from 'vscode-ws-jsonrpc/lib/socket/connection';
import { IConnection } from 'vscode-ws-jsonrpc/lib/server/connection';
import * as launch from 'vscode-ws-jsonrpc/lib/server/launch';
import { ContributionProvider, ConnectionHandler, MaybePromise } from '../../common';
import { WebSocketChannel } from '../../common/messaging/web-socket-channel';
import { BackendApplicationContribution } from '../backend-application';
import { MessagingService } from './messaging-service';
import { ConsoleLogger } from './logger';

import Route = require('route-parser');

@injectable()
export class MessagingContribution implements BackendApplicationContribution, MessagingService {

    @inject(ContributionProvider) @named(ConnectionHandler)
    protected readonly handlers: ContributionProvider<ConnectionHandler>;

    @inject(ContributionProvider) @named(MessagingService.Contribution)
    protected readonly contributions: ContributionProvider<MessagingService.Contribution>;

    protected readonly wsHandlers = new MessagingContribution.ConnectionHandlers<ws>();
    protected readonly channelHandlers = new MessagingContribution.ConnectionHandlers<WebSocketChannel>();

    @postConstruct()
    protected init(): void {
        this.ws(WebSocketChannel.wsPath, (_, socket) => this.handleChannels(socket));
        for (const contribution of this.contributions.getContributions()) {
            contribution.configure(this);
        }
        for (const handler of this.handlers.getContributions()) {
            this.listen(handler.path, (params, connection) =>
                handler.onConnection(connection)
            );
        }
    }

    listen(spec: string, callback: (params: MessagingService.PathParams, connection: MessageConnection) => void): void {
        return this.wsChannel(spec, (params, channel) => {
            const connection = createWebSocketConnection(channel, new ConsoleLogger());
            callback(params, connection);
        });
    }

    forward(spec: string, callback: (params: MessagingService.PathParams, connection: IConnection) => MaybePromise<void>): void {
        return this.wsChannel(spec, (params, channel): MaybePromise<void> => {
            const connection = launch.createWebSocketConnection(channel);
            return callback(params, connection);
        });
    }

    wsChannel(spec: string, callback: (params: MessagingService.PathParams, channel: WebSocketChannel) => MaybePromise<void>): void {
        return this.channelHandlers.push(spec, (params, channel): MaybePromise<void> => callback(params, channel));
    }

    ws(spec: string, callback: (params: MessagingService.PathParams, socket: ws) => void): void {
        return this.wsHandlers.push(spec, callback);
    }

    protected checkAliveTimeout = 30000;
    onStart(server: http.Server | https.Server): void {
        const wss = new ws.Server({
            server,
            perMessageDeflate: false
        });
        interface CheckAliveWS extends ws {
            alive: boolean;
        }
        wss.on('connection', async (socket: CheckAliveWS, request) => {
            socket.alive = true;
            socket.on('pong', () => socket.alive = true);
            await this.handleConnection(socket, request);
        });
        setInterval(() => {
            wss.clients.forEach((socket: CheckAliveWS) => {
                if (socket.alive === false) {
                    return socket.terminate();
                }
                socket.alive = false;
                socket.ping();
            });
        }, this.checkAliveTimeout);
    }

    protected async handleConnection(socket: ws, request: http.IncomingMessage): Promise<void> {
        const pathname = request.url && url.parse(request.url).pathname;
        if (pathname && !await this.wsHandlers.route(pathname, socket)) {
            console.error('Cannot find a ws handler for the path: ' + pathname);
        }
    }

    protected handleChannels(socket: ws): void {
        const channels = new Map<number, WebSocketChannel>();
        socket.on('message', async data => {
            try {
                const message: WebSocketChannel.Message = JSON.parse(data.toString());
                if (message.kind === 'open') {
                    const { id, path } = message;
                    const channel = this.createChannel(id, socket);
                    if (await this.channelHandlers.route(path, channel)) {
                        channel.ready();
                        channels.set(id, channel);
                        channel.onClose(() => channels.delete(id));
                    } else {
                        console.error('Cannot find a service for the path: ' + path);
                    }
                } else {
                    const { id } = message;
                    const channel = channels.get(id);
                    if (channel) {
                        channel.handleMessage(message);
                    } else {
                        console.error('The ws channel does not exist', id);
                    }
                }
            } catch (error) {
                console.error('Failed to handle message', { error, data });
            }
        });
        socket.on('error', err => {
            for (const channel of channels.values()) {
                channel.fireError(err);
            }
        });
        socket.on('close', (code, reason) => {
            for (const channel of [...channels.values()]) {
                channel.close(code, reason);
            }
            channels.clear();
        });
    }

    protected createChannel(id: number, socket: ws): WebSocketChannel {
        return new WebSocketChannel(id, content => {
            if (socket.readyState < ws.CLOSING) {
                socket.send(content, err => {
                    if (err) {
                        throw err;
                    }
                });
            }
        });
    }

}
export namespace MessagingContribution {
    export class ConnectionHandlers<T> {
        protected readonly handlers: ((path: string, connection: T) => Promise<string | false>)[] = [];

        push(spec: string, callback: (params: MessagingService.PathParams, connection: T) => MaybePromise<void>): void {
            const route = new Route(spec);
            this.handlers.push(async (path, channel): Promise<string | false> => {
                const params = route.match(path);
                if (!params) {
                    return false;
                }
                await callback(params, channel);
                return route.reverse(params);
            });
        }

        async route(path: string, connection: T): Promise<string | false> {
            for (const handler of this.handlers) {
                try {
                    const result = await handler(path, connection);
                    if (result) {
                        return result;
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            return false;
        }
    }
}
