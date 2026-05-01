import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com\/(?:v\/|embed\/|watch(?:\/|\?v=)))([a-zA-Z0-9_-]{11})(?:\S+)?$/;

export const PLAYLIST_REGEX = /[&?]list=([a-zA-Z0-9_-]+)/;

export const SPOTIFY_TRACK_REGEX =
  /^(?:https?:\/\/)?(?:open\.)?spotify\.com\/track\/([a-zA-Z0-9]+)/;
export const SPOTIFY_PLAYLIST_REGEX =
  /^(?:https?:\/\/)?(?:open\.)?spotify\.com\/playlist\/([a-zA-Z0-9]+)/;
