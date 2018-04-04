/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from "inversify";
import { BaseLanguageServerContribution, IConnection } from "@theia/languages/lib/node";
import { TYPESCRIPT_LANGUAGE_ID, TYPESCRIPT_LANGUAGE_NAME, TYPESCRIPT_LINT_LANGUAGE_ID, TYPESCRIPT_LINT_LANGUAGE_NAME } from '../common';
import { JAVASCRIPT_LANGUAGE_ID, JAVASCRIPT_LANGUAGE_NAME } from '../common';

@injectable()
export abstract class AbstractTypeScriptContribution extends BaseLanguageServerContribution {

    start(clientConnection: IConnection): void {
        const command = "node";
        const args: string[] = [
            __dirname + "/startserver.js",
            '--stdio'
        ];
        const serverConnection = this.createProcessStreamConnection(command, args);
        this.forward(clientConnection, serverConnection);
    }
}

@injectable()
export class TypeScriptContribution extends AbstractTypeScriptContribution {

    readonly id = TYPESCRIPT_LANGUAGE_ID;
    readonly name = TYPESCRIPT_LANGUAGE_NAME;

}

@injectable()
export class JavaScriptContribution extends AbstractTypeScriptContribution {

    readonly id = JAVASCRIPT_LANGUAGE_ID;
    readonly name = JAVASCRIPT_LANGUAGE_NAME;

}

@injectable()
export class TypescriptLinterContribution extends BaseLanguageServerContribution {

    readonly id = TYPESCRIPT_LINT_LANGUAGE_ID;
    readonly name = TYPESCRIPT_LINT_LANGUAGE_NAME;

    start(clientConnection: IConnection): void {
        const command = "node";
        const args: string[] = [
            "/home/emaisin/src/vscode-tslint/tslint/server/tslintServer.js",
            '--stdio'
        ];
        const serverConnection = this.createProcessStreamConnection(command, args);
        this.forward(clientConnection, serverConnection);
    }
}
