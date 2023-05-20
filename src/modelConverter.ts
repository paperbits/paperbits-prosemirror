import { BlockModel } from "@paperbits/common/text/models";

export class ModelConverter {
    public static modelToProseMirrorModel(source: BlockModel[]): any {
        let result = JSON.stringify(source);

        result = result
            .replaceAll(`ordered-list`, `ordered_list`)
            .replaceAll(`bulleted-list`, `bulleted_list`)
            .replaceAll(`list-item`, `list_item`)
            .replaceAll(`"nodes":`, `"content":`);

        return JSON.parse(result);
    }

    public static proseMirrorModelToModel(source: any): BlockModel[] {
        let result = JSON.stringify(source);

        result = result
            .replaceAll(`ordered_list`, `ordered-list`)
            .replaceAll(`bulleted_list`, `bulleted-list`)
            .replaceAll(`list_item`, `list-item`)
            .replaceAll(`"content":`, `"nodes":`);

        return JSON.parse(result);
    }
}