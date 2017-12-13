/**
 * Generated using theia-extension-generator
 */

import { SearchInWorkspaceCommandContribution, SearchInWorkspaceMenuContribution } from './search-in-workspace-contribution';
import {
    CommandContribution,
    MenuContribution
} from "@theia/core/lib/common";

import { ContainerModule } from "inversify";

export default new ContainerModule(bind => {
    // add your contribution bindings here

    bind(CommandContribution).to(SearchInWorkspaceCommandContribution);
    bind(MenuContribution).to(SearchInWorkspaceMenuContribution);

});
