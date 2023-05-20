import * as ko from "knockout";
import { BlockModel } from "@paperbits/common/text/models";
import { ProseMirrorRenderer } from "./prosemirrorRenderer";


const renderer = new ProseMirrorRenderer();

ko.bindingHandlers["textblock"] = {
    init(element: HTMLElement, valueAccessor: () => BlockModel[]): void {
        const blockModels = valueAccessor();
        renderer.renderBlock(element, ko.unwrap(blockModels))
    }
};
