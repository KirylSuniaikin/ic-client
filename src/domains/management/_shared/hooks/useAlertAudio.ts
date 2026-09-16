import { useEffect, useRef } from 'react';
import alertSound from '../../../../assets/audio/alert2.mp3';
import type { Order } from '../../../order/types';
import { logger } from '../../../../shared/utils/logger';

export type UseAlertAudioResult = {
    stopSound: () => void;
};

// A WebSocket frame can set alertOrder/editedOrder the instant the socket (re)connects — including
// right after page load, before the staff member has clicked anything on /admin. Browsers reject
// unsolicited audio.play() in that case (autoplay policy); that's expected, not a bug, so it's
// caught and logged rather than left as an unhandled rejection (which would otherwise reach the
// app's global error reporter and alert on a known, non-actionable browser restriction).
function playSafely(audio: HTMLAudioElement): void {
    audio.play().catch(err => {
        logger.debug('Alert sound blocked by the browser (likely no user interaction yet):', err);
    });
}

export function useAlertAudio(alertOrder: Order | null, editedOrder: Order | null): UseAlertAudioResult {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => { audioRef.current = new Audio(alertSound); audioRef.current.loop = true; }, []);
    useEffect(() => {
        if (!alertOrder || !audioRef.current) return;
        audioRef.current.currentTime = 0;
        playSafely(audioRef.current);
    }, [alertOrder]);
    useEffect(() => {
        if (!editedOrder || !audioRef.current) return;
        audioRef.current.currentTime = 0;
        playSafely(audioRef.current);
    }, [editedOrder]);

    const stopSound = (): void => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    };

    return { stopSound };
}
