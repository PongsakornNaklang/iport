import type { ComponentType } from 'react';
import type { AppId } from '../state';
import { MusicApp, AudiobooksApp } from './Music';
import { VideosApp } from './Videos';
import { FitnessApp } from './Fitness';
import { PodcastsApp } from './Podcasts';
import { PhotosApp } from './Photos';
import { RadioApp } from './Radio';
import { ClockApp } from './Clock';
import { SettingsApp } from './Settings';
import { ITunesUApp, VoiceMemosApp } from './Misc';

export const APPS: Record<AppId, ComponentType<{ active: boolean }>> = {
  music: MusicApp,
  videos: VideosApp,
  fitness: FitnessApp,
  podcasts: PodcastsApp,
  photos: PhotosApp,
  radio: RadioApp,
  settings: SettingsApp,
  clock: ClockApp,
  audiobooks: AudiobooksApp,
  itunesu: ITunesUApp,
  voicememos: VoiceMemosApp,
};
