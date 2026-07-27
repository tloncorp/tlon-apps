import ExpoModulesCore

public final class TlonScrollEdgeEffectModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TlonScrollEdgeEffect")

        View(ScrollEdgeElementContainer.self) {
            Prop("edge") { (view: ScrollEdgeElementContainer, edge: String?) in
                view.setEdge(edge)
            }

            Prop("scrollViewNativeID") { (view: ScrollEdgeElementContainer, nativeID: String?) in
                view.setScrollViewNativeID(nativeID)
            }
        }

    }
}
