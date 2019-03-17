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

    private modelToProseMirrorModel(source: any): any {
        let result = JSON.stringify(source);

        result = result
            .replaceAll(`ordered-list`, `ordered_list`)
            .replaceAll(`bulleted-list`, `bulleted_list`)
            .replaceAll(`list-item`, `list_item`);

        return JSON.parse(result);
    }

    private proseMirrorModelToModel(source: any): any {
        let result = JSON.stringify(source);

        result = result
            .replaceAll(`ordered_list`, `ordered-list`)
            .replaceAll(`bulleted_list`, `bulleted-list`)
            .replaceAll(`list_item`, `list-item`);

        return JSON.parse(result);
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

    public getSelectionState(): SelectionState {
        const state = this.editorView.state;

        let from = state.selection.from;
        const to = state.selection.to;

        if (from === to) {
            from -= 1;
        }

        const selectionState = new SelectionState();

        const cursor = state.selection.$cursor;

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

            if (currentBlock.attrs && currentBlock.attrs.styles && currentBlock.attrs.styles.alignment) {
                selectionState.alignment = currentBlock.attrs.styles.alignment;
            }
        }

        return selectionState;
    }

    private markExtend($cursor, markType) {
        let startIndex = $cursor.index();
        let endIndex = $cursor.indexAfter();

        const hasMark = (index: number) =>
            markType.isInSet($cursor.parent.child(index).marks);

        // Clicked outside edge of tag.
        if (startIndex === $cursor.parent.childCount) {
            startIndex--;
        }
        while (startIndex > 0 && hasMark(startIndex)) {
            startIndex--;
        }
        while (endIndex < $cursor.parent.childCount && hasMark(endIndex)) {
            endIndex++;
        }

        let startPos = $cursor.start();
        let endPos = startPos;

        for (let i = 0; i < endIndex; i++) {
            const size = $cursor.parent.child(i).nodeSize;
            if (i < startIndex) startPos += size;
            endPos += size;
        }

        return { from: startPos, to: endPos };
    }

    public removeHyperlink(): void {
        const state = this.editorView.state;
        const hyperlinkMark = state.selection.$from.marks().find(x => x.type.name === "hyperlink");

        if (!hyperlinkMark) {
            return;
        }

        const extendedSelection = this.markExtend(state.selection.$cursor, this.schema.marks.hyperlink);

        this.editorView.dispatch(state.tr.removeMark(extendedSelection.from, extendedSelection.to, this.schema.marks.hyperlink));
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

    public setColor(colorKey: string): void {
        const state = this.editorView.state;
        const className = this.styleCompiler.getClassNameByColorKey(colorKey);
        this.updateMark(state.schema.marks.color, this.schema.marks.color, { colorKey: colorKey, colorClass: className });
    }

    public removeColor(): void {
        const state = this.editorView.state;
        const { doc, selection } = this.editorView.state;
        if (doc.rangeHasMark(selection.from, selection.to, this.schema.marks.color)) {
            this.editorView.dispatch(state.tr.removeMark(selection.from, selection.to, this.schema.marks.color));
            this.editorView.focus();
        }
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

    public setHyperlink(hyperlink: HyperlinkModel): void {
        const state = this.editorView.state;

        if (!hyperlink.href && !hyperlink.targetKey) {
            return;
        }

        this.updateMark(state.schema.marks.hyperlink, this.schema.marks.hyperlink, hyperlink);
    }

    private updateMark(mark, markType, markAttrs: Object) {
        const state = this.editorView.state;

        const { doc, selection } = this.editorView.state;

        if (selection.empty) {
            return;
        }
        if (doc.rangeHasMark(selection.from, selection.to, markType)) {
            state.tr.removeMark(selection.from, selection.to, markType);
        }
        const markItem = mark.create(markAttrs);
        this.editorView.dispatch(state.tr.addMark(selection.from, selection.to, markItem));
    }

    public getHyperlink(): HyperlinkModel { // TODO: Move to Selection state
        const hyperlinkMark = this.editorView.state.selection.$from.marks().find(x => x.type.name === "hyperlink");

        if (!hyperlinkMark) {
            return null;
        }
        return hyperlinkMark.attrs;
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
        const cursor = this.editorView.state.selection.$cursor;

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