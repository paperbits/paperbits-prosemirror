import { Schema } from "prosemirror-model";

export class SchemaBuilder {
    private setupBlock(tag: string): any {
        return {
            group: "block",
            content: "inline*",
            attrs: {
                id: { default: null },
                className: { default: null },
                styles: { default: null }
            },
            toDOM: (node) => {
                const properties: any = {};

                if (node.attrs.id) {
                    properties.id = node.attrs.id;
                }
    
                if (node.attrs.className) {
                    properties.class = node.attrs.className;
                }
    
                return [tag, properties, 0];
            },
            parseDOM: [{ tag: tag }]
        };
    }

    private setupHeading(tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): any {
        const block = this.setupBlock(tag);

        block.parseDOM = <any>[{
            tag: tag,
            getAttrs: (dom) => {
                return {
                    id: dom.hasAttribute("id") ? dom.getAttribute("id") : null
                };
            }
        }];

        return block;
    }

    public build(): Schema {
        const nodes: Object = {
            text: {
                group: "inline",
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
            heading1: this.setupHeading("h1"),
            heading2: this.setupHeading("h2"),
            heading3: this.setupHeading("h3"),
            heading4: this.setupHeading("h4"),
            heading5: this.setupHeading("h5"),
            heading6: this.setupHeading("h6"),
            quote: this.setupBlock("blockquote"),
            break: {
                inline: true,
                group: "inline",
                selectable: false,
                parseDOM: [{ tag: "br" }],
                toDOM: () => ["br"]
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
            code: {
                toDOM: () => { return ["code"]; },
                parseDOM: [{ tag: "code" }]
            },
            color: {
                attrs: {
                    colorKey: {},
                    colorClass: {},
                },
                toDOM: (node) => {
                    return ["span", { class: node.attrs.colorClass }];
                }
            },
            hyperlink: {
                attrs: {
                    href: { default: undefined },
                    anchor: { default: undefined },
                    anchorName: { default: undefined },
                    targetKey: { default: undefined },
                    target: { default: undefined }
                },
                toDOM: (node) => {
                    return ["a", { href: `${node.attrs.href}${node.attrs.anchor ? "#" + node.attrs.anchor : ""}`, target: node.attrs.target }];
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