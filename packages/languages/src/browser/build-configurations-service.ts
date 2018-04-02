/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Event, Emitter, ILogger } from '@theia/core/lib/common';
import { injectable, inject, postConstruct } from 'inversify';
import { FileSystem, FileStat } from '@theia/filesystem/lib/common';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import URI from '@theia/core/lib/common/uri';
import { ParseError, parse } from 'jsonc-parser';

export const BuildConfigurationService = Symbol("BuildConfigurationService");
export interface BuildConfigurationService {
    getConfigurations(): Promise<BuildConfiguration[]>;
    getActiveConfiguration(): Promise<BuildConfiguration | undefined>;
    changeActiveConfiguration(config: BuildConfiguration | undefined): void;
    readonly onActiveBuildConfigChanged: Event<BuildConfiguration | undefined>;
}

export interface BuildConfiguration {
    name: string;
    directory: string;
}

class SavedActiveBuildConfiguration {
    configName: string | undefined;
}

/* Define and inject a function that gets the workspace root, to avoid having
 * to depend on WorkspaceService, which is much harder to mock.  */
export const GetWorkspaceRoot = Symbol('GetWorkspaceRoot');
export interface GetWorkspaceRoot {
    (): Promise<FileStat | undefined>;
}

@injectable()
export class BuildConfigurationServiceImpl implements BuildConfigurationService {

    protected readonly onActiveBuildConfigChangedEmitter = new Emitter<BuildConfiguration | undefined>();
    readonly onActiveBuildConfigChanged = this.onActiveBuildConfigChangedEmitter.event;

    protected configurations: Promise<BuildConfiguration[]>;
    protected activeConfiguration: Promise<BuildConfiguration | undefined>;

    /**
     * Resolved when we are done loading the active configuration (or realized
     * there is none).  This is used in the test, regular clients should use the
     * onActiveBuildConfigChanged event instead.
     */
    public activeConfigurationLoaded: Promise<BuildConfiguration | undefined>;

    readonly ACTIVE_BUILD_CONFIGURATION_STORAGE_KEY = 'active-build-configuration';

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(GetWorkspaceRoot)
    protected readonly getWorkspaceRoot: GetWorkspaceRoot;

    @postConstruct()
    init() {
        console.log("ALLO!");
        this.configurations = this.loadConfigurations();
        this.activeConfigurationLoaded = this.loadActiveConfiguration();
        this.activeConfigurationLoaded.then((config: BuildConfiguration | undefined) => {
            this.changeActiveConfiguration(config);
        });
    }

    /**
     * Load the build configuration from the config file in the workspace.
     */
    protected async loadConfigurations(): Promise<BuildConfiguration[]> {
        const root = await this.getWorkspaceRoot();
        if (!root) {
            throw Error("No workspace root.");
        }

        const buildsJsonURI = new URI(root.uri).resolve('.theia').resolve('builds.json');

        try {
            const contents = await this.fileSystem.resolveContent(buildsJsonURI.toString());
            const errors: ParseError[] = [];
            const buildConfigList = parse(contents.content, errors);

            if (errors.length > 0) {
                throw Error(`Error reading ${buildsJsonURI.toString()}: ${errors[0].error} at offset ${errors[0].offset}.`);
            }

            if (buildConfigList.builds === undefined) {
                return [];
            }

            return buildConfigList.builds;
        } catch (e) {
            this.logger.error(e);
            return Promise.resolve([]);
        }
    }

    /**
     * Load the active build config from the persistent storage.
     */
    protected async loadActiveConfiguration(): Promise<BuildConfiguration | undefined> {
        /* Fetch the config name from the persistent storage.  */
        const savedConfig =
            await this.storageService.getData<SavedActiveBuildConfiguration>(
                this.ACTIVE_BUILD_CONFIGURATION_STORAGE_KEY);

        let config: BuildConfiguration | undefined = undefined;

        if (savedConfig !== undefined && savedConfig.configName !== undefined) {
            /* Try to find an existing config with that name.  */
            const configs = await this.configurations;
            config = configs.find((element: BuildConfiguration) => savedConfig.configName === element.name);
        }

        return config;
    }

    /**
     * Save the active build config name to persistent storage.
     */
    protected async saveActiveConfiguration(config: BuildConfiguration | undefined) {
        this.storageService.setData<SavedActiveBuildConfiguration>(
            this.ACTIVE_BUILD_CONFIGURATION_STORAGE_KEY, {
                configName: config ? config.name : undefined,
            });
    }

    getActiveConfiguration(): Promise<BuildConfiguration | undefined> {
        return this.activeConfiguration;
    }

    changeActiveConfiguration(config: BuildConfiguration | undefined) {
        this.activeConfiguration = Promise.resolve(config);

        /* Save to persistent storage.  */
        this.saveActiveConfiguration(config);

        this.onActiveBuildConfigChangedEmitter.fire(config);
    }

    async getConfigurations(): Promise<BuildConfiguration[]> {
        return this.configurations;
    }
}
