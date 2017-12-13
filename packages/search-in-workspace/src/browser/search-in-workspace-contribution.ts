import { injectable, inject } from "inversify";
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from "@theia/core/lib/common";
import { CommonMenus } from "@theia/core/lib/browser";

export const SearchInWorkspaceCommand = {
    id: 'SearchInWorkspace.command',
    label: "Shows a message"
};

@injectable()
export class SearchInWorkspaceCommandContribution implements CommandContribution {

    constructor(
        @inject(MessageService) private readonly messageService: MessageService,
    ) { }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(SearchInWorkspaceCommand, {
            execute: () => this.messageService.info('Hello World!')
        });
    }
}

@injectable()
export class SearchInWorkspaceMenuContribution implements MenuContribution {

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.EDIT_FIND, {
            commandId: SearchInWorkspaceCommand.id,
            label: 'Say Hello'
        });
    }
}
