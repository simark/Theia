/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from "inversify";
import {
    BaseLanguageClientContribution, LanguageClientFactory, LanguageClientOptions, DidChangeConfigurationParams, ILanguageClient, DidChangeConfigurationNotification
} from '@theia/languages/lib/browser';
import { Languages, Workspace } from "@theia/languages/lib/common";
import { ILogger } from '@theia/core/lib/common/logger';
import { MessageService } from '@theia/core/lib/common/message-service';
import { CPP_LANGUAGE_ID, CPP_LANGUAGE_NAME, HEADER_AND_SOURCE_FILE_EXTENSIONS } from '../common';
import { BuildConfiguration, BuildConfigurationService } from "@theia/languages/lib/browser/build-configurations-service";

@injectable()
export class CppClientContribution extends BaseLanguageClientContribution {

    readonly id = CPP_LANGUAGE_ID;
    readonly name = CPP_LANGUAGE_NAME;

    @inject(BuildConfigurationService)
    protected readonly buildConfigurationService: BuildConfigurationService;

    constructor(
        @inject(Workspace) protected readonly workspace: Workspace,
        @inject(Languages) protected readonly languages: Languages,
        @inject(LanguageClientFactory) protected readonly languageClientFactory: LanguageClientFactory,
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(ILogger) protected readonly logger: ILogger,
    ) {
        super(workspace, languages, languageClientFactory);
    }

    protected onReady(languageClient: ILanguageClient): void {
        super.onReady(languageClient);

        this.buildConfigurationService.onActiveBuildConfigChanged(config => this.onActiveBuildConfigChanged(config));

        this.buildConfigurationService.getActiveConfiguration().then(config => {
            this.onActiveBuildConfigChanged(config);
        });
    }

    async onActiveBuildConfigChanged(config: BuildConfiguration | undefined) {
        if (!config) {
            // What do?
            return;
        }

        const interfaceParams: DidChangeConfigurationParams = {
            settings: {
                compilationDatabasePath: config.directory,
            },
        };

        const languageClient = await this.languageClient;
        languageClient.sendNotification(DidChangeConfigurationNotification.type, interfaceParams); // AnyRequest
    }

    protected get documentSelector() {
        return HEADER_AND_SOURCE_FILE_EXTENSIONS;
    }

    protected get globPatterns() {
        return [
            '**/*.{' + HEADER_AND_SOURCE_FILE_EXTENSIONS.join() + '}'
        ];
    }

    protected createOptions(): LanguageClientOptions {
        const clientOptions = super.createOptions();
        clientOptions.initializationFailedHandler = () => {
            const READ_INSTRUCTIONS_ACTION = "Read Instructions";
            const ERROR_MESSAGE = "Error starting C/C++ language server. " +
                "Please make sure 'clangd' is installed on your system. " +
                "You can refer to the clangd page for instructions.";
            this.messageService.error(ERROR_MESSAGE, READ_INSTRUCTIONS_ACTION).then(selected => {
                if (READ_INSTRUCTIONS_ACTION === selected) {
                    window.open("https://clang.llvm.org/extra/clangd.html");
                }
            });
            this.logger.error(ERROR_MESSAGE);
            return false;
        };
        return clientOptions;
    }
}
