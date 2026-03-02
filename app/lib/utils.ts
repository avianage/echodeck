import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const YT_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com\/(?:v\/|embed\/|watch(?:\/|\?v=)))([a-zA-Z0-9_-]{11})(?:\S+)?$/;

export const PLAYLIST_REGEX = /[&?]list=([a-zA-Z0-9_-]+)/;
