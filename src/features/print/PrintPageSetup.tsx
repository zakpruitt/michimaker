import {useBinderState} from "../binder/BinderContext";

export function PrintPageSetup() {
    const {binder} = useBinderState();
    if (binder.pocketColumns !== 4) {
        return null;
    }
    return <style>{"@media print { @page { size: A4 landscape; } }"}</style>;
}
