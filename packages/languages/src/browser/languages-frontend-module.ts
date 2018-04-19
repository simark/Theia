/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { bindContributionProvider, CommandContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, KeybindingContribution } from "@theia/core/lib/browser";
import { Window, WindowImpl } from '../common';
import { LanguageClientFactory } from './language-client-factory';
import { LanguagesFrontendContribution } from './languages-frontend-contribution';
import { LanguageClientContribution } from "./language-client-contribution";
import { WorkspaceSymbolCommand } from './workspace-symbols';
import { LanguageClientProvider } from './language-client-provider';
import { LanguageClientProviderImpl } from './language-client-provider-impl';
import { BuildConfigurationServiceImpl, BuildConfigurationService } from "./build-configurations-service";
import { BuildConfigurationsContributions, ChangeBuildConfiguration } from "./build-configurations-contributions";
import { GetWorkspaceRoot } from "./build-configurations-service";
import { WorkspaceService } from "@theia/workspace/lib/browser";

export default new ContainerModule(bind => {
    bind(Window).to(WindowImpl).inSingletonScope();

    bind(LanguageClientFactory).toSelf().inSingletonScope();

    bindContributionProvider(bind, LanguageClientContribution);
    bind(FrontendApplicationContribution).to(LanguagesFrontendContribution);

    bind(WorkspaceSymbolCommand).toSelf().inSingletonScope();
    bind(CommandContribution).toDynamicValue(ctx => ctx.container.get(WorkspaceSymbolCommand));
    bind(KeybindingContribution).toDynamicValue(ctx => ctx.container.get(WorkspaceSymbolCommand));

    bind(LanguageClientProviderImpl).toSelf().inSingletonScope();
    bind(LanguageClientProvider).toDynamicValue(ctx => ctx.container.get(LanguageClientProviderImpl)).inSingletonScope();

    // Build configuration stuff.
    bind(GetWorkspaceRoot).toDynamicValue(ctx => {
        const ws: WorkspaceService = ctx.container.get(WorkspaceService);
        return () => ws.root;
    });
    bind(BuildConfigurationService).to(BuildConfigurationServiceImpl).inSingletonScope();
    bind(ChangeBuildConfiguration).toSelf().inSingletonScope();
    bind(BuildConfigurationsContributions).toSelf().inSingletonScope();
    bind(CommandContribution).to(BuildConfigurationsContributions).inSingletonScope();
});
