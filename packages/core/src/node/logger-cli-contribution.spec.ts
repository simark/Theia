/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as chai from "chai";
import * as yargs from 'yargs';
import * as temp from 'temp';
import * as fs from 'fs';
import { ContainerModule, Container } from "inversify";
import { LogLevel } from "../common/logger";
import { expectThrowsAsync } from "../common/test/expect";
import { LogLevelCliContribution } from "./logger-cli-contribution";

// Allow creating temporary files, but remove them when we are done.
const track = temp.track();

const expect = chai.expect;

let cli: LogLevelCliContribution;

beforeEach(function () {
    const container = new Container();

    const module = new ContainerModule(bind => {
        bind(LogLevelCliContribution).toSelf().inSingletonScope();
    });

    container.load(module);

    cli = container.get(LogLevelCliContribution);
    yargs.reset();
    cli.configure(yargs);
});

describe('log-level-cli-contribution', function () {

    it('should use --log-level flag', async function () {
        const args: yargs.Arguments = yargs.parse(['--log-level=debug']);
        await cli.setArguments(args);

        expect(cli.defaultLogLevel).eq(LogLevel.DEBUG);
    });

    it('should read json config file', async function () {
        const file = track.openSync();
        fs.writeFileSync(file.fd, JSON.stringify({
            default: 'info',
            loggers: {
                'hello': 'debug',
                'world': 'fatal',
            }
        }));
        fs.fsyncSync(file.fd);
        fs.closeSync(file.fd);

        const args: yargs.Arguments = yargs.parse(['--log-levels-file', file.path]);
        await cli.setArguments(args);

        expect(cli.defaultLogLevel).eq(LogLevel.INFO);
        expect(cli.logLevels).eql({
            hello: LogLevel.DEBUG,
            world: LogLevel.FATAL,
        });
    });

    it('should use info as default log level', async function () {
        const args: yargs.Arguments = yargs.parse([]);
        await cli.setArguments(args);

        expect(cli.defaultLogLevel).eq(LogLevel.INFO);
        expect(cli.logLevels).eql({});
    });

    it('should reject wrong default log level', async function () {
        const file = track.openSync();
        fs.writeFileSync(file.fd, JSON.stringify({
            default: 'potato',
            loggers: {
                'hello': 'debug',
                'world': 'fatal',
            }
        }));

        const args: yargs.Arguments = yargs.parse(['--log-levels-file', file.path]);
        await expectThrowsAsync(cli.setArguments(args), Error, 'Unknown default log level in');
    });

    it('should reject wrong logger log level', async function () {
        const file = track.openSync();
        fs.writeFileSync(file.fd, JSON.stringify({
            default: 'info',
            loggers: {
                'hello': 'potato',
                'world': 'fatal',
            }
        }));

        const args: yargs.Arguments = yargs.parse(['--log-levels-file', file.path]);
        await expectThrowsAsync(cli.setArguments(args), Error, 'Unknown log level for logger hello in');
    });

    it('should reject nonexistent config files', async function () {
        const args: yargs.Arguments = yargs.parse(['--log-levels-file', '/patch/doesnt/exist']);
        await expectThrowsAsync(cli.setArguments(args), Error, 'no such file or directory');
    });

    it('should reject config file with invalid JSON', async function () {
        const file = track.openSync();
        const text = JSON.stringify({
            default: 'info',
            loggers: {
                'hello': 'potato',
                'world': 'fatal',
            }
        });
        fs.writeFileSync(file.fd, '{' + text);

        const args: yargs.Arguments = yargs.parse(['--log-levels-file', file.path]);
        await expectThrowsAsync(cli.setArguments(args), Error, 'Unexpected token { in JSON at position 1');
    });

    it('should watch the config file', async function () {
        const file = track.openSync();
        fs.writeFileSync(file.fd, JSON.stringify({
            default: 'info',
            loggers: {
                'hello': 'debug',
                'world': 'fatal',
            }
        }));
        fs.fsyncSync(file.fd);

        const args: yargs.Arguments = yargs.parse(['--log-levels-file', file.path]);
        await cli.setArguments(args);

        expect(cli.defaultLogLevel).eq(LogLevel.INFO);
        expect(cli.logLevels).eql({
            hello: LogLevel.DEBUG,
            world: LogLevel.FATAL,
        });

        const gotEvent = new Promise<void>(resolve => {
            cli.onLogLevelsChange(() => resolve());

            fs.ftruncateSync(file.fd);
            fs.writeFileSync(file.fd, JSON.stringify({
                default: 'debug',
                loggers: {
                    'bonjour': 'debug',
                    'world': 'trace',
                }
            }));
            fs.fsyncSync(file.fd);
        });

        await gotEvent;

        expect(cli.defaultLogLevel).eq(LogLevel.DEBUG);
        expect(cli.logLevels).eql({
            bonjour: LogLevel.DEBUG,
            world: LogLevel.TRACE,
        });
    });

    it('should keep original levels when changing the log levels file with a broken one', async function () {
        this.timeout(5000);

        const file = track.openSync();
        fs.writeFileSync(file.fd, JSON.stringify({
            default: 'info',
            loggers: {
                'hello': 'debug',
                'world': 'fatal',
            }
        }));
        fs.fsyncSync(file.fd);

        const args: yargs.Arguments = yargs.parse(['--log-levels-file', file.path]);
        await cli.setArguments(args);

        expect(cli.defaultLogLevel).eq(LogLevel.INFO);
        expect(cli.logLevels).eql({
            hello: LogLevel.DEBUG,
            world: LogLevel.FATAL,
        });

        const waitForTwoSeconds = new Promise<void>(resolve => {
            fs.ftruncateSync(file.fd);
            const text = '{' + JSON.stringify({
                default: 'debug',
                loggers: {
                    'bonjour': 'debug',
                    'world': 'trace',
                }
            });
            fs.writeFileSync(file.fd, text);
            fs.fsyncSync(file.fd);

            // Check in two seconds that the log levels haven't changed.
            setTimeout(resolve, 2000);
        });

        await waitForTwoSeconds;

        expect(cli.defaultLogLevel).eq(LogLevel.INFO);
        expect(cli.logLevels).eql({
            hello: LogLevel.DEBUG,
            world: LogLevel.FATAL,
        });
    });
});
