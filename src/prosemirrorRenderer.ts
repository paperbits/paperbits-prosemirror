import { BlockModel } from "@paperbits/common/text/models";
import { ProsemirrorSchemaBuilder } from "./prosemirrorSchemaBuilder";
import { DOMSerializer, Schema } from "prosemirror-model";
import { ModelConverter } from "./modelConverter";


export class ProseMirrorRenderer {
    private readonly schema: Schema<any, any>;
    private readonly serializer: DOMSerializer;

    constructor() {
        const builder = new ProsemirrorSchemaBuilder();
        this.schema = builder.build();
        this.serializer = DOMSerializer.fromSchema(this.schema);
    }

    public renderBlock(element: HTMLElement, blockContent: BlockModel[]): void {
        try {
            const prosemirrorContent = ModelConverter.modelToProseMirrorModel(blockContent);

            const content: any = {
                type: "doc",
                content: prosemirrorContent
            };

            const node: any = this.schema.nodeFromJSON(content);
            const fragment = this.serializer.serializeFragment(node);

            element.appendChild(fragment);
        }
        catch (error) {
            console.error(error.stack);
        }
    }
}