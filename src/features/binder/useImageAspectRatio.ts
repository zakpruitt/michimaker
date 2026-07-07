import {useEffect, useState} from "react";

const aspectRatioCache = new Map<string, number>();

export function useImageAspectRatio(imageUrl: string): number | null {
    const [aspectRatio, setAspectRatio] = useState<number | null>(
        () => aspectRatioCache.get(imageUrl) ?? null
    );

    useEffect(() => {
        const cached = aspectRatioCache.get(imageUrl);
        if (cached !== undefined) {
            setAspectRatio(cached);
            return;
        }

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                const ratio = image.naturalWidth / image.naturalHeight;
                aspectRatioCache.set(imageUrl, ratio);
                if (!cancelled) {
                    setAspectRatio(ratio);
                }
            }
        };
        image.src = imageUrl;

        return () => {
            cancelled = true;
        };
    }, [imageUrl]);

    return aspectRatio;
}
