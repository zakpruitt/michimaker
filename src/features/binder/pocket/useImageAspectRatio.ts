import {useEffect, useState} from "react";

const aspectRatioCache = new Map<string, number>();

export function useImageAspectRatio(imageUrl: string): number | null {
    const [loaded, setLoaded] = useState<{url: string; ratio: number} | null>(null);
    const cached = aspectRatioCache.get(imageUrl);

    useEffect(() => {
        if (aspectRatioCache.has(imageUrl)) {
            return;
        }
        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                const ratio = image.naturalWidth / image.naturalHeight;
                aspectRatioCache.set(imageUrl, ratio);
                if (!cancelled) {
                    setLoaded({url: imageUrl, ratio});
                }
            }
        };
        image.src = imageUrl;
        return () => {
            cancelled = true;
        };
    }, [imageUrl]);

    return cached ?? (loaded?.url === imageUrl ? loaded.ratio : null);
}
