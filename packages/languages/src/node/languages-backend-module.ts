/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { bindContributionProvider, ILogger } from '@theia/core/lib/common';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { LanguagesBackendContribution } from "./languages-backend-contribution";
import { LanguageServerContribution } from "./language-server-contribution";

export default new ContainerModule(bind => {
    bind(BackendApplicationContribution).to(LanguagesBackendContribution).inSingletonScope();
    bindContributionProvider(bind, LanguageServerContribution);

    bind(ILogger).toDynamicValue(ctx => {
        const logger = ctx.container.get<ILogger>(ILogger);
        return logger.child('languages');
    }).inSingletonScope().whenTargetNamed('languages');
});
