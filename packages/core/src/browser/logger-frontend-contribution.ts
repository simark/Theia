/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { CommandContribution, CommandRegistry, Command } from "../common/command";
import { QuickOpenService, QuickOpenModel, QuickOpenItem, QuickOpenMode } from './quick-open';
import { ILoggerServer, LoggerInfo } from '../common/logger-protocol';
import { LogLevel } from '../common/logger';

export namespace LoggerCommand {
    /** Open a the quick open menu to choose a logger, then a log level.  */
    export const SET_LOG_LEVEL: Command = {
        id: 'core.setLogLevel',
        label: 'Set Log Level'
    };
}

@injectable()
export class LoggerFrontendContribution implements CommandContribution {
    @inject(QuickOpenService)
    protected openService: QuickOpenService;

    @inject(ILoggerServer)
    protected loggerServer: ILoggerServer;

    protected async executeSetLogLevel() {
        const loggers = await this.loggerServer.getLoggers();

        this.openService.open(
            new LoggersQuickOpenModel(loggers, this.openService, this.loggerServer),
            {
                fuzzyMatchLabel: true,
                placeholder: "Select a logger...",
            }
        );
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(LoggerCommand.SET_LOG_LEVEL, {
            execute: () => this.executeSetLogLevel()
        });
    }
}

/** Quick open item for the second step, when choosing a log level.  */
class LogLevelQuickOpenItem extends QuickOpenItem {
    constructor(
        levelStr: string,
        protected level: LogLevel,
        protected logger: LoggerInfo,
        protected loggerServer: ILoggerServer,
    ) {
        super({
            label: levelStr,
            description: level === logger.level ? 'current' : undefined,
        });
    }

    run(mode: QuickOpenMode) {
        if (mode !== QuickOpenMode.OPEN) {
            return false;
        }

        this.loggerServer.setLogLevel(this.logger.name, this.level);
        return true;
    }
}

/** Quick open model for the second step, when choosing a log level.  */
class LogLevelQuickOpenModel implements QuickOpenModel {
    protected items: LogLevelQuickOpenItem[] = [];

    constructor(protected logger: LoggerInfo, loggerServer: ILoggerServer) {
        LogLevel.strings.forEach((str: string, level: LogLevel) => {
            this.items.push(new LogLevelQuickOpenItem(str, level, logger, loggerServer));
        });
    }

    onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
        acceptor(this.items);
    }
}

/** Quick open item for the first step, when choosing a logger.  */
class LoggerQuickOpenItem extends QuickOpenItem {
    constructor(
        protected logger: LoggerInfo,
        protected quickOpenService: QuickOpenService,
        protected loggerServer: ILoggerServer,
    ) {
        super({
            label: logger.name,
            description: LogLevel.toString(logger.level),
        });
    }

    run(mode: QuickOpenMode): boolean {
        if (mode !== QuickOpenMode.OPEN) {
            return false;
        }

        this.quickOpenService.open(
            new LogLevelQuickOpenModel(this.logger, this.loggerServer),
            {
                fuzzyMatchLabel: true,
                placeholder: `Select a log level for ${this.logger.name}...`,
                selectIndex: (lookfor: string): number => {
                    /* By default, select the current log level.  */
                    if (lookfor.length > 0) {
                        return -1;
                    }

                    const levels = Array.from(LogLevel.strings.keys());
                    return levels.indexOf(this.logger.level);
                }
            }
        );

        return false;
    }
}

/** Quick open model for the first step, when choosing a logger.  */
class LoggersQuickOpenModel implements QuickOpenModel {
    protected items: QuickOpenItem[] = [];

    constructor(
        loggers: LoggerInfo[],
        quickOpenService: QuickOpenService,
        loggerServer: ILoggerServer
    ) {
        for (const logger of loggers) {
            this.items.push(new LoggerQuickOpenItem(logger, quickOpenService, loggerServer));
        }
    }

    onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
        acceptor(this.items);
    }
}
