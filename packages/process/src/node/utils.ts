/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

const stringArgv = require('string-argv');
import { isWindows, isOSX } from '@theia/core/lib/common/os';

/**
 * Parses the given line into an array of args respecting escapes and string literals.
 * @param line the given line to parse
 */
export function parseArgs(line: string): string[] {
    return stringArgv(line);
}

export function getDefaultShellExecutablePath(): string {
    const shell = process.env.THEIA_SHELL;
    if (shell) {
        return shell;
    }

    if (isWindows) {
        return 'cmd.exe';
    } else {
        return process.env.SHELL!;
    }
}

export function getDefaultShellExecutableArgs(): string[] {
    const args = process.env.THEIA_SHELL_ARGS;
    if (args) {
        return parseArgs(args);
    }
    if (isOSX) {
        return ['-l'];
    } else {
        return [];
    }
}

export interface ShellExecAndArgs {
    shellExecutable: string;
    shellArguments: string[];
}

/**
 * Make
 */
export function makeShellExecAndArgs(command: string, args?: string[]): ShellExecAndArgs {
    if (args) {
        command = command.concat(args.join(' '));
    }

    if (isWindows) {
        return {
            shellExecutable: getDefaultShellExecutablePath(),
            shellArguments: ['/d', '/s', '/c', command],
        };
    } else {
        return {
            shellExecutable: getDefaultShellExecutablePath(),
            shellArguments: ['-c', command],
        };
    }
}
