/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from "inversify";
import { SelectionService } from '@theia/core/lib/common';
import { CommandContribution, CommandRegistry, Command } from '@theia/core/lib/common';
import URI from "@theia/core/lib/common/uri";
import { open, OpenerService, } from '@theia/core/lib/browser';
import { CppClientContribution } from "./cpp-client-contribution";
import { SwitchSourceHeaderRequest } from "./cpp-protocol";
import { TextDocumentIdentifier, } from "@theia/languages/lib/common";
import { FileDialogFactory } from '@theia/filesystem/lib/browser';
import { EditorManager } from "@theia/editor/lib/browser";
import { HEADER_AND_SOURCE_FILE_EXTENSIONS } from '../common';
import { FileSystem } from "@theia/filesystem/lib/common";
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { LabelProvider } from "@theia/core/lib/browser/label-provider";
import { } from "@theia/languages/lib/browser/build-configurations";

/**
 * Switch between source/header file
 */
export const SWITCH_SOURCE_HEADER: Command = {
    id: 'switch_source_header',
    label: 'C++: Switch between source/header file'
};

export interface ClangdConfigurationParams {
    compilationDatabasePath?: string;
}

export function editorContainsCppFiles(editorManager: EditorManager | undefined): boolean {
    if (editorManager && editorManager.activeEditor) {
        const uri = editorManager.activeEditor.editor.document.uri;
        return HEADER_AND_SOURCE_FILE_EXTENSIONS.some(value => uri.endsWith("." + value));
    }
    return false;
}

@injectable()
export class CppCommandContribution implements CommandContribution {

    constructor(
        @inject(FileSystem) protected readonly fileSystem: FileSystem,
        @inject(FileDialogFactory) protected readonly fileDialogFactory: FileDialogFactory,
        @inject(CppClientContribution) protected readonly clientContribution: CppClientContribution,
        @inject(OpenerService) protected readonly openerService: OpenerService,
        @inject(EditorManager) private editorService: EditorManager,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(LabelProvider) protected readonly labelProvider: LabelProvider,
        protected readonly selectionService: SelectionService

    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(SWITCH_SOURCE_HEADER, {
            isEnabled: () => editorContainsCppFiles(this.editorService),
            execute: () => this.switchSourceHeader()
        });
    }

    protected switchSourceHeader(): void {
        const docIdentifier = TextDocumentIdentifier.create(this.selectionService.selection.uri.toString());
        this.clientContribution.languageClient.then(languageClient => {
            languageClient.sendRequest(SwitchSourceHeaderRequest.type, docIdentifier).then(sourceUri => {
                if (sourceUri !== undefined) {
                    open(this.openerService, new URI(sourceUri.toString()));
                }
            });
        });
    }
}
