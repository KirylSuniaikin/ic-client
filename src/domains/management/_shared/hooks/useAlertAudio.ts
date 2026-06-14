import { useEffect, useRef } from 'react';
import alertSound from '../../../../assets/audio/alert2.mp3';
import type { Order } from '../../../order/types';

export type UseAlertAudioResult = {
    stopSound: () => void;
};

export function useAlertAudio(alertOrder: Order | null, editedOrder: Order | null): UseAlertAudioResult {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => { audioRef.current = new Audio(alertSound); audioRef.current.loop = true; }, []);
    useEffect(() => {
        if (!alertOrder || !audioRef.current) return;
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
    }, [alertOrder]);
    useEffect(() => {
        if (!editedOrder || !audioRef.current) return;
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
    }, [editedOrder]);

    const stopSound = (): void => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    };

    return { stopSound };
}
