/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import {
    BaseLanguageClientContribution,
    Workspace, Languages, LanguageClientFactory, DocumentSelector, ILanguageClient,
    DidChangeConfigurationParams, DidChangeConfigurationNotification, WorkspaceEdit
} from '@theia/languages/lib/browser';
import { TYPESCRIPT_LANGUAGE_ID, TYPESCRIPT_LANGUAGE_NAME, TYPESCRIPT_LINT_LANGUAGE_ID, TYPESCRIPT_LINT_LANGUAGE_NAME } from '../common';
import { JAVASCRIPT_LANGUAGE_ID, JAVASCRIPT_LANGUAGE_NAME } from '../common/index';
import { CommandContribution, Command, CommandRegistry } from "@theia/core";

@injectable()
export class TypeScriptClientContribution extends BaseLanguageClientContribution {

    readonly id = TYPESCRIPT_LANGUAGE_ID;
    readonly name = TYPESCRIPT_LANGUAGE_NAME;

    constructor(
        @inject(Workspace) protected readonly workspace: Workspace,
        @inject(Languages) protected readonly languages: Languages,
        @inject(LanguageClientFactory) protected readonly languageClientFactory: LanguageClientFactory
    ) {
        super(workspace, languages, languageClientFactory);
    }

    protected get globPatterns() {
        return [
            '**/*.ts',
            '**/*.tsx'
        ];
    }

}

/**
 * tslint command to apply a single fix.
 */
const APPLY_SINGLE_FIX: Command = {
    id: '_tslint.applySingleFix'
};

@injectable()
export class TypeScriptLinterClientContribution extends BaseLanguageClientContribution implements CommandContribution {

    readonly id = TYPESCRIPT_LINT_LANGUAGE_ID;
    readonly name = TYPESCRIPT_LINT_LANGUAGE_NAME;

    constructor(
        @inject(Workspace) protected readonly workspace: Workspace,
        @inject(Languages) protected readonly languages: Languages,
        @inject(LanguageClientFactory) protected readonly languageClientFactory: LanguageClientFactory
    ) {
        super(workspace, languages, languageClientFactory);
    }

    protected onReady(languageClient: ILanguageClient): void {
        super.onReady(languageClient);

        /* tslint-server needs to receive some configuration to become active.  */
        const params: DidChangeConfigurationParams = {
            settings: {
                enable: true,
                run: 'onType',
            }
        };
        languageClient.sendNotification(DidChangeConfigurationNotification.type, params);
    }

    protected get documentSelector(): DocumentSelector | undefined {
        return ['typescript'];
    }

    protected get globPatterns() {
        return [
            '**/*.ts',
            '**/*.tsx'
        ];
    }

    registerCommands(commandRegistry: CommandRegistry) {
        commandRegistry.registerCommand(APPLY_SINGLE_FIX, {
            execute: (changes: WorkspaceEdit) =>
                !!this.workspace.applyEdit && this.workspace.applyEdit(changes)
        });
    }
}

@injectable()
export class JavaScriptClientContribution extends BaseLanguageClientContribution {

    readonly id = JAVASCRIPT_LANGUAGE_ID;
    readonly name = JAVASCRIPT_LANGUAGE_NAME;

    constructor(
        @inject(Workspace) protected readonly workspace: Workspace,
        @inject(Languages) protected readonly languages: Languages,
        @inject(LanguageClientFactory) protected readonly languageClientFactory: LanguageClientFactory
    ) {
        super(workspace, languages, languageClientFactory);
    }

    protected get globPatterns() {
        return [
            '**/*.js',
            '**/*.jsx',
        ];
    }

}
