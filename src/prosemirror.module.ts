import { IInjector, IInjectorModule } from "@paperbits/common/injection";
import { ProseMirrorHtmlEditor } from "./prosemirrorHtmlEditor";

export class ProseMirrorModule implements IInjectorModule {
    public register(injector: IInjector): void {
        injector.bind("htmlEditor", ProseMirrorHtmlEditor);
        
        injector.bind("htmlEditorFactory", () => {
            return {
                createHtmlEditor: () => {
                    return injector.resolve("htmlEditor");
                }
            };
        });
    }
}