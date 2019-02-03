import { Schema } from "prosemirror-model";
import * as Utils from "@paperbits/common/utils";
import { IStyleCompiler } from "@paperbits/common/styles";

export class SchemaBuilder {
    constructor(private readonly styleCompiler: IStyleCompiler) {
    }

    private setupBlock(tag: string, setId = false) {
        return {
            group: "block",
            content: "inline*",
            attrs: {
                styles: { default: null },
                setId: { default: setId }
            },
            toDOM: (node) => {
                const result = [tag, {}, 0];
                if (node.attrs.styles) {
                    const className = this.styleCompiler.getClassNamesByStyleConfig(node.attrs.styles);
                    result[1] = { class: className };
                }
                if (node.attrs.setId) {
                    result[1]["id"] = node.textContent ? Utils.slugify(node.textContent) : Utils.identifier();
                }
                return result;
            },
            parseDOM: [{ tag: tag }]
        };
    }

    public build(): Schema {
        const nodes: Object = {
            text: {
                group: "inline",
            },
            tmp: {
                group: "block",
                content: "inline*",
                toDOM: () => ["tmp", 0],
                parseDOM: [{ tag: "tmp" }]
            },
            linebreak: {
                group: "block",
                content: "",
                toDOM: () => ["br", 0],
                parseDOM: [{ tag: "br" }]
            },
            paragraph: this.setupBlock("p"),
            formatted: this.setupBlock("pre"),
            ordered_list: {
                content: "list_item+",
                group: "block",
                attrs: { order: { default: 1 } },
                parseDOM: [{
                    tag: "ol",
                    getAttrs: (dom) => {
                        return { order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1 };
                    }
                }],
                toDOM: (node) => {
                    return node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0];
                }
            },
            bulleted_list: {
                content: "list_item+",
                group: "block",
                parseDOM: [{ tag: "ul" }],
                toDOM: () => {
                    return ["ul", 0];
                }
            },
            list_item: {
                content: "paragraph block*",
                parseDOM: [{
                    tag: "li"
                }],
                toDOM: () => {
                    return ["li", 0];
                },
                defining: true
            },
            heading1: this.setupBlock("h1", true),
            heading2: this.setupBlock("h2", true),
            heading3: this.setupBlock("h3", true),
            heading4: this.setupBlock("h4", true),
            heading5: this.setupBlock("h5", true),
            heading6: this.setupBlock("h6", true),
            quote: this.setupBlock("blockquote"),
            link: {
                content: "inline*",
                attrs: {
                    href: { default: null },
                    contentTypeKey: { default: null },
                    target: { default: null }
                },
                toDOM: (node) => {
                    return ["a", { href: node.attrs.href }];
                },
                parseDOM: [{
                    tag: "a",
                    getAttrs: (dom) => { return { href: dom.href }; }
                }],
                inclusive: false
            },
            hard_break: {
                inline: true,
                group: "inline",
                selectable: false,
                parseDOM: [{ tag: "br" }],
                toDOM() { return ["br"]; }
            },
            doc: {
                content: "block+"
            }
        };

        const marks: Object = {
            bold: {
                toDOM: () => { return ["b"]; },
                parseDOM: [{ tag: "b" }]
            },
            italic: {
                toDOM: () => { return ["i"]; },
                parseDOM: [{ tag: "i" }]
            },
            underlined: {
                toDOM: () => { return ["u"]; },
                parseDOM: [{ tag: "u" }]
            },
            highlighted: {
                toDOM: () => { return ["mark"]; },
                parseDOM: [{ tag: "mark" }]
            },
            color: {
                attrs: {
                    colorKey: {},
                },
                toDOM: (node) => {
                    const className = this.styleCompiler.getClassNameByColorKey(node.attrs.colorKey);
                    return ["span", { class: className }];
                }
            },
            hyperlink: {
                attrs: {
                    href: {},
                    contentTypeKey: {},
                    target: {}
                },
                toDOM: (node) => {
                    return ["a", { href: node.attrs.href }];
                },
                parseDOM: [{
                    tag: "a",
                    getAttrs: (dom) => { return { href: dom.href }; }
                }],
                inclusive: false
            }
        };

        const schema = new Schema({
            nodes: <any>nodes,
            marks: <any>marks
        });

        return schema;
    }
}