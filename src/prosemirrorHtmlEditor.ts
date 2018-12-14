import { IEventManager } from "@paperbits/common/events";
import * as Utils from "@paperbits/common/utils";
import { IViewManager } from "@paperbits/common/ui";
import { IStyleService } from "@paperbits/common/styles";
import { IHtmlEditor, SelectionState, HtmlEditorEvents, HyperlinkContract } from "@paperbits/common/editing";
import { Box } from "@paperbits/common/editing/box";


import { Schema, DOMParser } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark, setBlockType, wrapIn, } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { findWrapping, Transform } from "prosemirror-transform";
import { keymap } from "prosemirror-keymap";
import { wrapInList } from "./lists";
import { buildKeymap } from "./keymap";
import { SchemaBuilder } from "./schema";
import { HyperlinkModel } from "@paperbits/common/permalinks";


export class ProseMirrorHtmlEditor implements IHtmlEditor {
    private host: HTMLElement;
    private editorView: EditorView;
    private blockNodes = ["H1", "H2", "H3", "H4", "H5", "H6", "P", "OL", "UL", "LI"];
    private schema: Schema;
    private content: any;

    constructor(
        readonly eventManager: IEventManager,
        readonly styleService: IStyleService

    ) {
        // rebinding...
        this.getState = this.getState.bind(this);
        this.insertText = this.insertText.bind(this);
        this.toggleBold = this.toggleBold.bind(this);
        this.toggleItalic = this.toggleItalic.bind(this);
        this.toggleUnderlined = this.toggleUnderlined.bind(this);
        this.toggleUnorderedList = this.toggleUnorderedList.bind(this);
        this.toggleOrderedList = this.toggleOrderedList.bind(this);
        this.toggleParagraph = this.toggleParagraph.bind(this);
        this.toggleH1 = this.toggleH1.bind(this);
        this.toggleH2 = this.toggleH2.bind(this);
        this.toggleH3 = this.toggleH3.bind(this);
        this.toggleH4 = this.toggleH4.bind(this);
        this.toggleH5 = this.toggleH5.bind(this);
        this.toggleH6 = this.toggleH6.bind(this);
        this.toggleFormatted = this.toggleFormatted.bind(this);
        // this.onHtmlEditorEvent = this.onHtmlEditorEvent.bind(this);
        // this.getSelectionBoundaries = this.getSelectionBoundaries.bind(this);
        // this.normalizeSelection = this.normalizeSelection.bind(this);
        this.detachFromElement = this.detachFromElement.bind(this);
        this.handleUpdates = this.handleUpdates.bind(this);

        // setting up...
        this.eventManager.addEventListener("onEscape", this.detachFromElement);

        const builder = new SchemaBuilder(this.styleService);
        this.schema = builder.build();
    }

    public getState(): Object {
        return this.editorView.state.toJSON()["doc"]["content"];
    }

    public setState(content: Object): void {
        this.content = {
            doc: {
                type: "doc",
                content: content
            },
            selection: {
                type: "text",
                anchor: 1,
                head: 1
            }
        };
    }

    public getSelectionState(): SelectionState {
        const state = this.editorView.state;

        let from = state.selection.from;
        const to = state.selection.to;

        if (from === to) {
            from -= 1;
        }

        const formatting = new SelectionState();

        const cursor = state.selection.$cursor;

        if (cursor) {
            const path = cursor.path.filter(x => x.type).map(x => x.type.name);
            formatting.block = path[path.length - 1];
            formatting.orderedList = path.contains("ordered_list");
            formatting.bulletedList = path.contains("bulleted_list");
            formatting.italic = state.doc.rangeHasMark(from, to, this.schema.marks.italic);
            formatting.underlined = state.doc.rangeHasMark(from, to, this.schema.marks.underlined);
            formatting.bold = state.doc.rangeHasMark(from, to, this.schema.marks.bold);
        }

        // const node = this.getClosestNode(this.blockNodes);

        // if (node) {
        //     const alignment = node["alignment"];

        //     if (alignment) {
        //         formatting.alignment = alignment[viewport];
        //     }

        //     const typography = node["typography"];

        //     if (typography) {
        //         formatting.font = typography.font;
        //     }

        //     if (node["anchorKey"]) {
        //         formatting.anchorKey = node["anchorKey"];
        //     }
        // }

        return formatting;
    }

    public removeHyperlink(): void {
        throw new Error("Not implemented");
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

    public setHyperlink(hyperlink: HyperlinkContract): void {
        const state = this.editorView.state;

        const { doc, selection } = this.editorView.state;

        if (selection.empty) {
            return;
        }

        if (!hyperlink.href && !hyperlink.permalinkKey) {
            return;
        }

        let attrs: any = null;

        if (!doc.rangeHasMark(selection.from, selection.to, this.schema.marks.hyperlink)) {
            attrs = {
                href: hyperlink.href,
                contentTypeKey: hyperlink.permalinkKey,
                target: hyperlink.target
            };
        }

        return toggleMark(this.schema.marks.hyperlink, attrs)(state, this.editorView.dispatch);
    }

    public getHyperlink(): HyperlinkModel { // TODO: Move to Selection state
        const hyperlinkMark = this.editorView.state.selection.$from.marks().find(x => x.type.name === "hyperlink");

        if (!hyperlinkMark) {
            return null;
        }

        const hyperlink = new HyperlinkModel();
        hyperlink.href = hyperlinkMark.attrs.href;
        hyperlink.targetKey = hyperlinkMark.attrs.contentTypeKey;
        hyperlink.target = hyperlinkMark.attrs.target;

        return hyperlink;
    }

    public setAnchor(hash: string, anchorKey: string): void {
        // const node = <HTMLElement>this.getClosestNode(this.blockNodes);

        // Bindings.applyAnchor(node, hash, anchorKey);
    }

    public removeAnchor(): void {
        // const node = <HTMLElement>this.getClosestNode(this.blockNodes);
        // Bindings.removeAnchor(node);
    }

    public setSelection(domSelection: Selection): void {
        // throw new Error("Not implemented");
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

    public alignLeft(): void {
        const cursor = this.editorView.state.selection.$cursor;

        if (!cursor) {
            return;
        }

        const path = cursor.path.filter(x => x.type);
        const currentBlock = path[path.length - 1];
        const blockType = currentBlock.type;

        setBlockType(this.schema.nodes.tmp)(this.editorView.state, this.editorView.dispatch);
        setBlockType(blockType, { styleKey: "globals/text/alignedLeft" })(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public alignCenter(): void {
        const cursor = this.editorView.state.selection.$cursor;

        if (!cursor) {
            return;
        }

        const path = cursor.path.filter(x => x.type);
        const currentBlock = path[path.length - 1];
        const blockType = currentBlock.type;

        setBlockType(this.schema.nodes.tmp)(this.editorView.state, this.editorView.dispatch);
        setBlockType(blockType, { styleKey: "globals/text/centered" })(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public alignRight(): void {
        const cursor = this.editorView.state.selection.$cursor;

        if (!cursor) {
            return;
        }

        const path = cursor.path.filter(x => x.type);
        const currentBlock = path[path.length - 1];
        const blockType = currentBlock.type;

        setBlockType(this.schema.nodes.tmp)(this.editorView.state, this.editorView.dispatch);
        setBlockType(blockType, { styleKey: "globals/text/alignedRight" })(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
    }

    public justify(): void {
        const cursor = this.editorView.state.selection.$cursor;

        if (!cursor) {
            return;
        }

        const path = cursor.path.filter(x => x.type);
        const currentBlock = path[path.length - 1];
        const blockType = currentBlock.type;

        setBlockType(this.schema.nodes.tmp)(this.editorView.state, this.editorView.dispatch);
        setBlockType(blockType, { styleKey: "globals/text/justified" })(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
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

    private content1 = {
        doc: {
            type: "doc", content: [{
                type: "paragraph", content: [{ type: "text", text: "This is a " },
                { type: "text", text: "nice" },
                { type: "text", text: " paragraph, it can have " },
                { type: "text", marks: [{ type: "bold" }], text: "anything" },
                { type: "text", text: " in it." }]
            },
            {
                type: "paragraph", content:
                    [{
                        type: "text",
                        text: "Press ctrl/cmd-space to insert a star, ctrl/cmd-b to toggle bold, and ctrl/cmd-q to add or remove a link."
                    }]
            }]
        }, selection: { type: "text", anchor: 1, head: 1 }
    };

    private handleUpdates(view, prevState) {
        this.eventManager.dispatchEvent("htmlEditorChanged", this);

        const state = view.state;

        if (prevState && !prevState.doc.eq(state.doc)) {
            this.eventManager.dispatchEvent("onContentUpdate");
        }

        if (prevState && !prevState.selection.eq(state.selection)) {
            this.eventManager.dispatchEvent("onSelectionChange", this);
        }
    }

    public attachToElement(element: HTMLElement): void {
        if (this.editorView) {
            this.editorView.dom.contentEditable = true;
            return;
        }

        this.host = element;

        const doc: any = this.schema.nodeFromJSON(this.content.doc);
        const histKeymap = keymap({ "Mod-z": undo, "Mod-y": redo });
        const hu = this.handleUpdates;

        const detectChangesPlugin = new Plugin({
            view(view) {
                return {
                    update: hu
                };
            }
        });

        const plugins = [detectChangesPlugin];

        this.editorView = new EditorView(element, {
            state: EditorState.create({
                doc,
                plugins: plugins.concat([
                    histKeymap,
                    keymap(buildKeymap(this.schema, null)),
                    keymap(baseKeymap),
                    history()])
            })
        });

        this.editorView.dom.contentEditable = false;

        this.eventManager.dispatchEvent(HtmlEditorEvents.onSelectionChange);
    }

    public detachFromElement(): void {
        // this.editorView.dom.contentEditable = false;
    }

    public addSelectionChangeListener(callback: () => void): void {
        this.eventManager.addEventListener(HtmlEditorEvents.onSelectionChange, callback);
    }

    public removeSelectionChangeListener(callback: (htmlEditor: IHtmlEditor) => void): void {
        // throw "Not implemented";
    }
}