/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable, named } from 'inversify';
import { ContributionProvider, CommandRegistry, MenuModelRegistry, ILogger } from '../common';
import { MaybePromise } from '../common/types';
import { KeybindingRegistry } from './keybinding';
import { Widget } from "./widgets";
import { ApplicationShell } from './shell/application-shell';
import { ShellLayoutRestorer } from './shell/shell-layout-restorer';

/**
 * Clients can implement to get a callback for contributing widgets to a shell on start.
 */
export const FrontendApplicationContribution = Symbol("FrontendApplicationContribution");
export interface FrontendApplicationContribution {

    /**
     * Called on application startup before onStart is called.
     */
    initialize?(): void;

    /**
     * Called when the application is started. The application shell is not attached yet when this method runs.
     * Should return a promise if it runs asynchronously.
     */
    onStart?(app: FrontendApplication): MaybePromise<void>;

    /**
     * Called when an application is stopped or unloaded.
     *
     * Note that this is implemented using `window.unload` which doesn't allow any asynchronous code anymore.
     * I.e. this is the last tick.
     */
    onStop?(app: FrontendApplication): void;

    onReady?(app: FrontendApplication): void;

    /**
     * Called after the application shell has been attached in case there is no previous workbench layout state.
     * Should return a promise if it runs asynchronously.
     */
    initializeLayout?(app: FrontendApplication): MaybePromise<void>;
}

/**
 * Default frontend contribution that can be extended by clients if they do not want to implement any of the
 * methods from the interface but still want to contribute to the frontend application.
 */
@injectable()
export abstract class DefaultFrontendApplicationContribution implements FrontendApplicationContribution {

    initialize() {
        // NOOP
    }

}

@injectable()
export class FrontendApplication {

    constructor(
        @inject(CommandRegistry) protected readonly commands: CommandRegistry,
        @inject(MenuModelRegistry) protected readonly menus: MenuModelRegistry,
        @inject(KeybindingRegistry) protected readonly keybindings: KeybindingRegistry,
        @inject(ILogger) protected readonly logger: ILogger,
        @inject(ShellLayoutRestorer) protected readonly layoutRestorer: ShellLayoutRestorer,
        @inject(ContributionProvider) @named(FrontendApplicationContribution)
        protected readonly contributions: ContributionProvider<FrontendApplicationContribution>,
        @inject(ApplicationShell) protected readonly _shell: ApplicationShell,
    ) { }

    get shell(): ApplicationShell {
        return this._shell;
    }

    /**
     * Start the frontend application.
     *
     * Start up consists of the following steps:
     * - start frontend contributions
     * - attach the application shell to the host element
     * - initialize the application shell layout
     * - reveal the application shell if it was hidden by a startup indicator
     */
    async start(): Promise<void> {
        this.shell.loading = true;
        await this.startContributions();
        const host = await this.getHost();
        this.attachShell(host);
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
        await this.initializeLayout();
        await this.revealShell(host);
        this.registerEventListeners();
        this.shell.loading = false;

        for (const pouet of this.contributions.getContributions()) {
            if (pouet.onReady) {
                await pouet.onReady(this);
            }
        }
    }

    /**
     * Return a promise to the host element to which the application shell is attached.
     */
    protected getHost(): Promise<HTMLElement> {
        if (document.body) {
            return Promise.resolve(document.body);
        }
        return new Promise<HTMLElement>(resolve =>
            window.onload = () => resolve(document.body)
        );
    }

    /**
     * Return an HTML element that indicates the startup phase, e.g. with an animation or a splash screen.
     */
    protected getStartupIndicator(host: HTMLElement): HTMLElement | undefined {
        const startupElements = host.getElementsByClassName('theia-preload');
        return startupElements.length === 0 ? undefined : startupElements[0] as HTMLElement;
    }

    /**
     * Register global event listeners.
     */
    protected registerEventListeners(): void {
        window.addEventListener('unload', () => {
            this.layoutRestorer.storeLayout(this);
            this.stopContributions();
        });
        window.addEventListener('resize', () => this.shell.update());
        document.addEventListener('keydown', event => this.keybindings.run(event), true);
    }

    /**
     * Attach the application shell to the host element. If a startup indicator is present, the shell is
     * inserted before that indicator so it is not visible yet.
     */
    protected attachShell(host: HTMLElement): void {
        const ref = this.getStartupIndicator(host);
        Widget.attach(this.shell, host, ref);
    }

    /**
     * If a startup indicator is present, it is first hidden with the `theia-hidden` CSS class and then
     * removed after a while. The delay until removal is taken from the CSS transition duration.
     */
    protected revealShell(host: HTMLElement): Promise<void> {
        const startupElem = this.getStartupIndicator(host);
        if (startupElem) {
            return new Promise(resolve => {
                window.requestAnimationFrame(() => {
                    startupElem.classList.add('theia-hidden');
                    const preloadStyle = window.getComputedStyle(startupElem);
                    const transitionDuration = this.parseCssTime(preloadStyle.transitionDuration);
                    window.setTimeout(() => {
                        const parent = startupElem.parentElement;
                        if (parent) {
                            parent.removeChild(startupElem);
                        }
                        resolve();
                    }, transitionDuration);
                });
            });
        } else {
            return Promise.resolve();
        }
    }

    /**
     * Parse the number of milliseconds from a CSS time value.
     */
    private parseCssTime(time: string | null): number {
        if (time) {
            if (time.endsWith('ms')) {
                return parseFloat(time.substring(0, time.length - 2));
            } else if (time.endsWith('s')) {
                return parseFloat(time.substring(0, time.length - 1)) * 1000;
            } else {
                return parseFloat(time);
            }
        }
        return 0;
    }

    /**
     * Initialize the shell layout either using the layout restorer service or, if no layout has
     * been stored, by creating the default layout.
     */
    protected async initializeLayout(): Promise<void> {
        if (!await this.restoreLayout()) {
            // Fallback: Create the default shell layout
            await this.createDefaultLayout();
        }
        await this.shell.pendingUpdates;
    }

    /**
     * Try to restore the shell layout from the storage service. Resolves to `true` if successful.
     */
    protected async restoreLayout(): Promise<boolean> {
        try {
            return await this.layoutRestorer.restoreLayout(this);
        } catch (error) {
            this.logger.error('Could not restore layout', error);
            return false;
        }
    }

    /**
     * Let the frontend application contributions initialize the shell layout. Override this
     * method in order to create an application-specific custom layout.
     */
    protected async createDefaultLayout(): Promise<void> {
        for (const initializer of this.contributions.getContributions()) {
            if (initializer.initializeLayout) {
                await initializer.initializeLayout(this);
            }
        }
    }

    /**
     * Initialize and start the frontend application contributions.
     */
    protected async startContributions(): Promise<void> {
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.initialize) {
                try {
                    contribution.initialize();
                } catch (error) {
                    this.logger.error('Could not initialize contribution', error);
                }
            }
        }

        /**
         * FIXME:
         * - decouple commands & menus
         * - consider treat commands, keybindings and menus as frontend application contributions
         */
        this.commands.onStart();
        this.keybindings.onStart();
        this.menus.onStart();
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onStart) {
                try {
                    await contribution.onStart(this);
                } catch (error) {
                    this.logger.error('Could not start contribution', error);
                }
            }
        }
    }

    /**
     * Stop the frontent application contributions. This is called when the window is unloaded.
     */
    protected stopContributions(): void {
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onStop) {
                try {
                    contribution.onStop(this);
                } catch (error) {
                    this.logger.error('Could not stop contribution', error);
                }
            }
        }
    }

}
