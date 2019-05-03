import { IEventManager } from "@paperbits/common/events";
import { IStyleCompiler } from "@paperbits/common/styles";
import { HyperlinkModel } from "@paperbits/common/permalinks";
import { IHtmlEditor, SelectionState, alignmentStyleKeys, HtmlEditorEvents } from "@paperbits/common/editing";
import { Schema, DOMSerializer } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark, setBlockType } from "prosemirror-commands";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { wrapInList } from "./lists";
import { buildKeymap } from "./keymap";
import { SchemaBuilder } from "./schema";

export class ProseMirrorHtmlEditor implements IHtmlEditor {
    private element: Element;
    private editorView: EditorView;
    private schema: Schema;
    private content: any;
    private node: any;

    constructor(
        readonly eventManager: IEventManager,
        readonly styleCompiler: IStyleCompiler
    ) {
        // setting up...
        this.eventManager.addEventListener("onEscape", this.detachFromElement.bind(this));

        const builder = new SchemaBuilder();
        this.schema = builder.build();
    }

    public getState(): Object {
        let content;

        if (this.editorView) {
            content = this.editorView.state.toJSON()["doc"]["content"];
        }
        else {
            content = this.content.content;
        }

        return this.proseMirrorModelToModel(content);
    }

    public setState(content: Object): void {
        content = this.modelToProseMirrorModel(content);

        this.content = {
            type: "doc",
            content: content
        };

        this.node = this.schema.nodeFromJSON(this.content);

        const fragment = DOMSerializer
            .fromSchema(this.schema)
            .serializeFragment(this.node);

        this.element.appendChild(fragment);
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

    private proseMirrorModelToModel(source: any): any {
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

        const cursor = state.selection.$cursor || state.selection.$from;

        if (cursor) {
            const path = cursor.path.filter(x => x.type);
            const currentBlock = path[path.length - 1];
            const blockType = currentBlock.type;
            const typeName = blockType.name;

            selectionState.block = blockType.name;
            selectionState.orderedList = typeName.contains("ordered_list");
            selectionState.bulletedList = typeName.contains("bulleted_list");
            selectionState.italic = state.doc.rangeHasMark(from, to, this.schema.marks.italic);
            selectionState.bold = state.doc.rangeHasMark(from, to, this.schema.marks.bold);
            selectionState.underlined = state.doc.rangeHasMark(from, to, this.schema.marks.underlined);
            selectionState.highlighted = state.doc.rangeHasMark(from, to, this.schema.marks.highlighted);
            selectionState.colorKey = this.getColor();

            if (currentBlock.attrs && currentBlock.attrs.styles && currentBlock.attrs.styles.alignment) {
                selectionState.alignment = currentBlock.attrs.styles.alignment;
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

    public toggleBold(): void {
        toggleMark(this.schema.marks.bold)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleItalic(): void {
        toggleMark(this.schema.marks.italic)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleUnderlined(): void {
        toggleMark(this.schema.marks.underlined)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleHighlighted(): void {
        toggleMark(this.schema.marks.highlighted)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleOrderedList(): void {
        wrapInList(this.schema.nodes.ordered_list)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleUnorderedList(): void {
        wrapInList(this.schema.nodes.bulleted_list)(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public toggleParagraph(): void {
        setBlockType(this.schema.nodes.paragraph)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleH1(): void {
        setBlockType(this.schema.nodes.heading1)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleH2(): void {
        setBlockType(this.schema.nodes.heading2)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleH3(): void {
        setBlockType(this.schema.nodes.heading3)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleH4(): void {
        setBlockType(this.schema.nodes.heading4)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleH5(): void {
        setBlockType(this.schema.nodes.heading5)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleH6(): void {
        setBlockType(this.schema.nodes.heading6)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleQuote(): void {
        setBlockType(this.schema.nodes.quote)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleFormatted(): void {
        setBlockType(this.schema.nodes.formatted)(this.editorView.state, this.editorView.dispatch);
    }

    public toggleSize(): void {
        // const blockNode = <HTMLElement>this.getClosestNode(this.blockNodes);
        // Bindings.applyTypography(blockNode, { size: "smaller" });
    }

    public setTypegraphy(font: string): void {
        // const blockNode = <HTMLElement>this.getClosestNode(this.blockNodes);
        // Bindings.applyTypography(blockNode, { font: font });
        // this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
    }

    private updateMark(markType, markAttrs: Object) {
        if (!markAttrs) {
            return;
        }
        const state = this.editorView.state;
        const tr = state.tr;
        const doc = tr.doc;

        const markLocation = (!state.selection.empty && state.selection) ||
            (state.selection.$cursor && this.getMarkLocation(doc, state.selection.$cursor.pos, markType));

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

    private removeMark(markType) {
        const state = this.editorView.state;
        const markLocation = (!state.selection.empty && state.selection) || this.getMarkLocation(state.tr.doc, state.selection.$cursor.pos, markType);

        if (!markLocation) {
            return;
        }

        this.editorView.dispatch(state.tr.removeMark(markLocation.from, markLocation.to, markType));
    }

    public setColor(colorKey: string): void {
        const className = this.styleCompiler.getClassNameByColorKey(colorKey);
        this.updateMark(this.schema.marks.color, { colorKey: colorKey, colorClass: className });
    }

    public getColor(): string {
        const mark = this.editorView.state.selection.$from.marks().find(x => x.type.name === "color");

        if (!mark) {
            return null;
        }
        return mark.attrs.colorKey;
    }

    public removeColor(): void {
        this.removeMark(this.schema.marks.color);
    }

    public removeHyperlink(): void {
        this.removeMark(this.schema.marks.hyperlink);
    }

    public setHyperlink(hyperlink: HyperlinkModel): void {
        if (!hyperlink.href && !hyperlink.targetKey) {
            return;
        }
        this.updateMark(this.schema.marks.hyperlink, hyperlink);
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

    public getHyperlink(): HyperlinkModel { // TODO: Move to Selection state
        const doc = this.editorView.state.tr.doc;
        if (this.editorView.state.selection.$cursor) {
            const $pos = doc.resolve(this.editorView.state.selection.$cursor.pos);
            const start = $pos.parent.childAfter($pos.parentOffset);
            if (!start.node) {
                return null;
            }

            const mark = start.node.marks.find((mark) => mark.type === this.schema.marks.hyperlink);
            return mark ? mark.attrs : null;
        } else {
            const $pos = doc.resolve(this.editorView.state.selection.$from.pos);
            const start = $pos.parent.childAfter($pos.parentOffset);
            if (!start.node) {
                return null;
            }

            const mark = start.node.marks.find((mark) => mark.type === this.schema.marks.hyperlink);
            return mark ? mark.attrs : null;
        }
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
        throw new Error("Not implemented");
    }

    public decreaseIndent(): void {
        throw new Error("Not implemented");
    }

    public expandSelection(to?: string): void {
        throw new Error("Not implemented");
    }

    private async setAlignment(styleKey: string, viewport: string = "xs") {
        const cursor = this.editorView.state.selection.$cursor || this.editorView.state.selection.$from;

        if (!cursor) {
            return;
        }

        const path = cursor.path.filter(x => x.type);
        const currentBlock = path[path.length - 1];
        const blockType = currentBlock.type;
        const blockStyle = currentBlock.attrs.styles || {};

        blockStyle.alignment = blockStyle.alignment || {};

        Object.assign(blockStyle.alignment, { [viewport]: styleKey });

        const className = await this.styleCompiler.getClassNamesByStyleConfigAsync(blockStyle);

        setBlockType(this.schema.nodes.paragraph)(this.editorView.state, this.editorView.dispatch);
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

    private handleUpdates(view, prevState): void {
        this.eventManager.dispatchEvent("htmlEditorChanged", this);

        const state = view.state;

        if (prevState && !prevState.doc.eq(state.doc)) {
            this.eventManager.dispatchEvent("onContentUpdate");
        }

        if (prevState && !prevState.selection.eq(state.selection)) {
            this.eventManager.dispatchEvent("onSelectionChange", this);
        }
    }

    public enable(): void {
        if (this.editorView) {
            this.editorView.dom.contentEditable = true;
            this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
            return;
        }

        const doc: any = this.schema.nodeFromJSON(this.content);

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
                    keymap(buildKeymap(this.schema, null)),
                    keymap(baseKeymap),
                    history()])
            })
        });

        this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
    }

    public disable(): void {
        if (!this.editorView) {
            return;
        }
        this.editorView.dom.contentEditable = false;
    }

    public attachToElement(element: HTMLElement): void {
        this.element = element;
    }

    public detachFromElement(): void {
        this.disable();
    }

    public addSelectionChangeListener(callback: () => void): void {
        this.eventManager.addEventListener(HtmlEditorEvents.onSelectionChange, callback);
    }

    public removeSelectionChangeListener(callback: (htmlEditor: IHtmlEditor) => void): void {
        this.eventManager.removeEventListener(HtmlEditorEvents.onSelectionChange, callback);
    }
}