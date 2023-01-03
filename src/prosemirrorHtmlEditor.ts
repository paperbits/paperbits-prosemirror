import { BlockModel } from "@paperbits/common/text/models";
import { EventManager } from "@paperbits/common/events";
import { StyleCompiler, LocalStyles } from "@paperbits/common/styles";
import { HyperlinkModel } from "@paperbits/common/permalinks";
import { IHtmlEditor, SelectionState, alignmentStyleKeys, HtmlEditorEvents } from "@paperbits/common/editing";
import { DOMSerializer } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark, setBlockType } from "prosemirror-commands";
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { wrapInList } from "./lists";
import { buildKeymap } from "./keymap";
import { ProsemirrorSchemaBuilder } from "./prosemirrorSchemaBuilder";
import { Attributes } from "@paperbits/common/html";

const builder = new ProsemirrorSchemaBuilder();
const schema = builder.build();

export class ProseMirrorHtmlEditor implements IHtmlEditor {
    private element: HTMLElement;
    private editorView: EditorView;
    private content: any;

    constructor(
        readonly eventManager: EventManager,
        readonly styleCompiler: StyleCompiler
    ) { }

    public onStateChange: (state: BlockModel[]) => void;

    public getState(): BlockModel[] {
        let content;

        if (this.editorView) {
            content = this.editorView.state.toJSON()["doc"]["content"];
        }
        else {
            content = this.content.content;
        }

        return this.proseMirrorModelToModel(content);
    }

    public setState(content: BlockModel[]): void {
        try {
            const prosemirrorContent = this.modelToProseMirrorModel(content);

            this.content = {
                type: "doc",
                content: prosemirrorContent
            };

            const node: any = schema.nodeFromJSON(this.content);

            const fragment = DOMSerializer
                .fromSchema(schema)
                .serializeFragment(node);

            this.element.appendChild(fragment);
        }
        catch (error) {
            console.error(error.stack);
        }
    }

    private modelToProseMirrorModel(source: any): any {
        let result = JSON.stringify(source);

        result = result
            .replaceAll(`ordered-list`, `ordered_list`)
            .replaceAll(`bulleted-list`, `bulleted_list`)
            .replaceAll(`list-item`, `list_item`)
            .replaceAll(`"nodes":`, `"content":`);

        return JSON.parse(result);
    }

    private proseMirrorModelToModel(source: any): BlockModel[] {
        let result = JSON.stringify(source);

        result = result
            .replaceAll(`ordered_list`, `ordered-list`)
            .replaceAll(`bulleted_list`, `bulleted-list`)
            .replaceAll(`list_item`, `list-item`)
            .replaceAll(`"content":`, `"nodes":`);

        return JSON.parse(result);
    }

    public getSelectionState(): SelectionState {
        const state = this.editorView.state;

        let from = state.selection.from;
        const to = state.selection.to;

        if (from === to) {
            from -= 1;
        }

        const selectionState = new SelectionState();
        const $anchor = state.selection.$anchor;

        if ($anchor) {
            const currentBlock = $anchor.node();
            const blockType = currentBlock.type;
            const typeName = blockType.name;

            selectionState.block = blockType.name;
            selectionState.orderedList = typeName.includes("ordered_list");
            selectionState.bulletedList = typeName.includes("bulleted_list");
            selectionState.italic = state.doc.rangeHasMark(from, to, schema.marks.italic);
            selectionState.bold = state.doc.rangeHasMark(from, to, schema.marks.bold);
            selectionState.underlined = state.doc.rangeHasMark(from, to, schema.marks.underlined);
            selectionState.highlighted = state.doc.rangeHasMark(from, to, schema.marks.highlighted);
            selectionState.striked = state.doc.rangeHasMark(from, to, schema.marks.striked);
            selectionState.code = state.doc.rangeHasMark(from, to, schema.marks.code);
            selectionState.colorKey = this.getColor();

            if (currentBlock.attrs && currentBlock.attrs.styles) {
                if (currentBlock.attrs.styles.alignment) {
                    selectionState.alignment = currentBlock.attrs.styles.alignment;
                }
                if (currentBlock.attrs.styles.appearance) {
                    selectionState.appearance = currentBlock.attrs.styles.appearance;
                }
            }
        }

        return selectionState;
    }

    public clearFormatting(): void {
        throw new Error("Not implemented");
    }

    public insertText(text: string): void {
        throw new Error("Not implemented");
    }

    public insertProperty(name: string, placeholder: string): void {
        const state = this.editorView.state;
        const dispatch = this.editorView.dispatch;
        const from = state.selection.$from;
        const index = from.index();
        const propertyType = schema.nodes.property;

        if (!from.parent.canReplaceWith(index, index, propertyType)) {
            return;
        }

        dispatch(state.tr.replaceSelectionWith(propertyType.create({ name: name, placeholder: placeholder })));
    }

    public toggleBold(): void {
        toggleMark(schema.marks.bold)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleItalic(): void {
        toggleMark(schema.marks.italic)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleUnderlined(): void {
        toggleMark(schema.marks.underlined)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleHighlighted(): void {
        toggleMark(schema.marks.highlighted)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleStriked(): void {
        toggleMark(schema.marks.striked)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleCode(): void {
        toggleMark(schema.marks.code)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleOrderedList(): void {
        wrapInList(schema.nodes.ordered_list)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public async toggleUnorderedList(styleKey: string = "globals/ul/default"): Promise<void> {
        let attrs = {};

        if (styleKey) {
            const className = await this.styleCompiler.getClassNameByStyleKeyAsync(styleKey);

            if (className) {
                attrs = { className: className, styles: { appearance: styleKey } };
            }
        }

        wrapInList(schema.nodes.bulleted_list, attrs)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleParagraph(): void {
        this.setBlockTypeAndNotify(schema.nodes.paragraph);
    }

    public toggleH1(): void {
        this.setBlockTypeAndNotify(schema.nodes.heading1);
    }

    public toggleH2(): void {
        this.setBlockTypeAndNotify(schema.nodes.heading2);
    }

    public toggleH3(): void {
        this.setBlockTypeAndNotify(schema.nodes.heading3);
    }

    public toggleH4(): void {
        this.setBlockTypeAndNotify(schema.nodes.heading4);
    }

    public toggleH5(): void {
        this.setBlockTypeAndNotify(schema.nodes.heading5);
    }

    public toggleH6(): void {
        this.setBlockTypeAndNotify(schema.nodes.heading6);
    }

    public toggleQuote(): void {
        this.setBlockTypeAndNotify(schema.nodes.quote);
    }

    public toggleFormatted(): void {
        this.setBlockTypeAndNotify(schema.nodes.formatted);
    }

    public toggleSize(): void {
        // const blockNode = <HTMLElement>this.getClosestNode(this.blockNodes);
        // Bindings.applyTypography(blockNode, { size: "smaller" });
    }

    private updateMark(markType: any, markAttrs: Object): void {
        if (!markAttrs) {
            return;
        }
        const state = this.editorView.state;
        const tr = state.tr;
        const doc = tr.doc;

        const markLocation = (!state.selection.empty && state.selection) ||
            (state.selection.$anchor && this.getMarkLocation(doc, state.selection.$anchor.pos, markType));

        if (!markLocation) {
            return;
        }

        if (state.selection.empty) {
            if (doc.rangeHasMark(markLocation.from, markLocation.to, markType)) {
                tr.removeMark(markLocation.from, markLocation.to, markType);
            } else {
                return;
            }
        }
        const markItem = markType.create(markAttrs);
        this.editorView.dispatch(tr.addMark(markLocation.from, markLocation.to, markItem));
    }

    private removeMark(markType: any): void {
        const state = this.editorView.state;
        const markLocation = (!state.selection.empty && state.selection) || this.getMarkLocation(state.tr.doc, state.selection.$anchor.pos, markType);

        if (!markLocation) {
            return;
        }

        this.editorView.dispatch(state.tr.removeMark(markLocation.from, markLocation.to, markType));
    }

    public setColor(colorKey: string): void {
        const className = this.styleCompiler.getClassNameByColorKey(colorKey);
        this.updateMark(schema.marks.color, { colorKey: colorKey, colorClass: className });
    }

    public getColor(): string {
        const mark = this.editorView.state.selection.$from.marks().find(x => x.type.name === "color");

        if (!mark) {
            return null;
        }
        return mark.attrs.colorKey;
    }

    public removeColor(): void {
        this.removeMark(schema.marks.color);
    }

    public removeHyperlink(): void {
        this.removeMark(schema.marks.hyperlink);
    }

    private getMarkLocation(doc, pos, markType): { from: number, to: number } {
        const $pos = doc.resolve(pos);

        const start = $pos.parent.childAfter($pos.parentOffset);
        if (!start.node) {
            return null;
        }

        const mark = start.node.marks.find((mark) => mark.type === markType);
        if (!mark) {
            return null;
        }

        let startIndex = $pos.index();
        let startPos = $pos.start() + start.offset;
        while (startIndex > 0 && mark.isInSet($pos.parent.child(startIndex - 1).marks)) {
            startIndex -= 1;
            startPos -= $pos.parent.child(startIndex).nodeSize;
        }

        let endIndex = $pos.indexAfter();
        let endPos = startPos + start.node.nodeSize;
        while (endIndex < $pos.parent.childCount && mark.isInSet($pos.parent.child(endIndex).marks)) {
            endPos += $pos.parent.child(endIndex).nodeSize;
            endIndex += 1;
        }

        return { from: startPos, to: endPos };
    }

    public setHyperlink(hyperlink: HyperlinkModel): void {
        if (!hyperlink.href && !hyperlink.targetKey) {
            return;
        }

        this.updateMark(schema.marks.hyperlink, hyperlink);
    }

    public getHyperlink(): HyperlinkModel { // TODO: Move to Selection state
        const doc = this.editorView.state.tr.doc;
        let $pos: any;

        if (this.editorView.state.selection.$anchor) {
            $pos = doc.resolve(this.editorView.state.selection.$anchor.pos);
        }
        else {
            $pos = doc.resolve(this.editorView.state.selection.$from.pos);
        }

        const start = $pos.parent.childAfter($pos.parentOffset);

        if (!start?.node) {
            return null;
        }

        const mark = start.node.marks.find((mark) => mark.type === schema.marks.hyperlink);
        return mark ? mark.attrs : null;
    }

    public setAnchor(hash: string, anchorKey: string): void {
        // const node = <HTMLElement>this.getClosestNode(this.blockNodes);

        // Bindings.applyAnchor(node, hash, anchorKey);
    }

    public removeAnchor(): void {
        // const node = <HTMLElement>this.getClosestNode(this.blockNodes);
        // Bindings.removeAnchor(node);
    }

    public getSelectionText(): string {
        throw new Error("Not implemented");
    }

    public resetToNormal(): void {
        // Ui.command(commands.p)({ selection: Api.editor.selection });
    }

    public increaseIndent(): void {
        sinkListItem(schema.nodes.list_item);
    }

    public decreaseIndent(): void {
        liftListItem(schema.nodes.list_item);
    }

    public expandSelection(to?: string): void {
        throw new Error("Not implemented");
    }

    public setTextStyle(textStyleKey: string, viewport?: string): void {
        this.updateTextStyle(textStyleKey, viewport);
    }

    private async updateTextStyle(textStyleKey: string, viewport: string = "xs"): Promise<void> {
        const $anchor = this.editorView.state.selection.$anchor;

        if (!$anchor) {
            return;
        }

        const currentBlock = $anchor.node();
        const blockType = currentBlock.type;
        const blockStyle: LocalStyles = currentBlock.attrs.styles || {};

        blockStyle.appearance = blockStyle.appearance || {};

        if (textStyleKey) {
            blockStyle.appearance = textStyleKey;
        }
        else {
            if (blockStyle.appearance) {
                delete blockStyle.appearance;
            }
        }

        setBlockType(schema.nodes.paragraph)(this.editorView.state, this.editorView.dispatch);

        if (Object.keys(blockStyle).length > 0) {
            const className = await this.styleCompiler.getClassNamesForLocalStylesAsync(blockStyle);
            setBlockType(blockType, { styles: blockStyle, className: className })(this.editorView.state, this.editorView.dispatch);
        }
        else {
            setBlockType(blockType)(this.editorView.state, this.editorView.dispatch);
        }
        this.editorView.focus();
        this.eventManager.dispatchEvent("onSelectionChange", this);
    }

    private async setAlignment(styleKey: string, viewport: string = "xs"): Promise<void> {
        const $anchor = this.editorView.state.selection.$anchor;

        if (!$anchor) {
            return;
        }

        const currentBlock = $anchor.node();
        const blockType = currentBlock.type;
        const blockStyle = currentBlock.attrs.styles || {};

        blockStyle.alignment = blockStyle.alignment || {};

        Object.assign(blockStyle.alignment, { [viewport]: styleKey });

        const className = await this.styleCompiler.getClassNamesForLocalStylesAsync(blockStyle);

        setBlockType(schema.nodes.paragraph)(this.editorView.state, this.editorView.dispatch);
        setBlockType(blockType, { styles: blockStyle, className: className })(this.editorView.state, this.editorView.dispatch);

        this.editorView.focus();
        this.eventManager.dispatchEvent("onSelectionChange", this);
    }

    public alignLeft(viewport: string = "xs"): void {
        this.setAlignment(alignmentStyleKeys.left, viewport);
    }

    public alignCenter(viewport: string = "xs"): void {
        this.setAlignment(alignmentStyleKeys.center, viewport);
    }

    public alignRight(viewport: string = "xs"): void {
        this.setAlignment(alignmentStyleKeys.right, viewport);
    }

    public justify(viewport: string = "xs"): void {
        this.setAlignment(alignmentStyleKeys.justify, viewport);
    }

    public setCaretAtEndOf(node: Node): void {
        // const boundary = Boundaries.fromEndOfNode(node);
        // Api.editor.selection = Selections.select(Api.editor.selection, boundary, boundary);
    }

    public setCaretAt(clientX: number, clientY: number): void {
        // const boundary = Boundaries.fromPosition(
        //     clientX + Dom.scrollLeft(document),
        //     clientY + Dom.scrollTop(document),
        //     document
        // );
        // Api.editor.selection = Selections.select(Api.editor.selection, boundary, boundary);
        // this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
    }

    private setBlockTypeAndNotify(blockType: any, attrs?: any): void {
        setBlockType(blockType, attrs)(this.editorView.state, this.editorView.dispatch);
        this.eventManager.dispatchEvent("onSelectionChange", this);
    }

    private handleUpdates(view: any, prevState: any): void {
        this.eventManager.dispatchEvent("htmlEditorChanged", this);

        const state = view.state;

        if (this.onStateChange && prevState && !prevState.doc.eq(state.doc)) {
            const newState = this.getState();
            this.onStateChange(newState);
        }

        if (prevState && !prevState.selection.eq(state.selection)) {
            this.eventManager.dispatchEvent("onSelectionChange", this);
        }
    }

    public enable(): void {
        if (this.editorView) {
            this.editorView.dom.setAttribute(Attributes.ContentEditable, "true");
            this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
            return;
        }

        const doc: any = schema.nodeFromJSON(this.content);

        const handleUpdates = this.handleUpdates.bind(this);

        const detectChangesPlugin = new Plugin({
            view(view) {
                return {
                    update: handleUpdates
                };
            }
        });

        const plugins = [detectChangesPlugin];

        this.editorView = new EditorView({ mount: this.element }, {
            state: EditorState.create({
                doc,
                plugins: plugins.concat([
                    keymap(buildKeymap(schema, null)),
                    keymap(baseKeymap),
                    history()])
            })
        });
        this.eventManager.dispatchEvent("htmlEditorChanged", this);
        this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
    }

    public disable(): void {
        if (!this.editorView) {
            return;
        }
        this.editorView.dom.removeAttribute(Attributes.ContentEditable);
    }

    public attachToElement(element: HTMLElement): void {
        this.element = element;
    }

    public detachFromElement(): void {
        this.disable();
    }
}