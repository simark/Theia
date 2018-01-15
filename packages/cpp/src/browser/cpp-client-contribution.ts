/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from "inversify";
import { BaseLanguageClientContribution, LanguageClientOptions } from '@theia/languages/lib/browser';
import { CPP_LANGUAGE_ID, CPP_LANGUAGE_NAME } from '../common';

@injectable()
export class CppClientContribution extends BaseLanguageClientContribution {

    readonly id = CPP_LANGUAGE_ID;
    readonly name = CPP_LANGUAGE_NAME;

    protected get documentSelector() {
        return [
            'h', 'hxx', 'hh', 'hpp', 'inc', 'c', 'cxx', 'C', 'c++', 'cc', 'cc', 'cpp'
        ];
    }

    protected get globPatterns() {
        return [
            '**/*.h', '**/*.hxx', '**/*.hh', '**/*.hpp', '**/*.inc', '**/*.c', '**/*.cxx', '**/*.C', '**/*.c++', '**/*.cc', '**/*.cc', '**/*.cpp'
        ];
    }

    protected createOptions(): LanguageClientOptions {
        const opts = super.createOptions();

        const initOpts = {
            cacheDirectory: '/tmp/cquery-cache'
        };

        opts.initializationOptions = initOpts;

        return opts;
    }

}
