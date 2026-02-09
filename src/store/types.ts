export interface AppState {
  appConfigMode: AppConfig;
}

export interface AppConfig {
  title: string;
  collapseMenu: boolean;
  themeMode: 'light' | 'dark';
  hideNavbart: boolean;
  hideTabs: boolean;
}

const defaultAppConfig: AppConfig = {
  title: 'Toolbox',
  collapseMenu: false,
  themeMode: 'light',
  hideNavbart: false,
  hideTabs: true,
};

export function getDefaultAppConfig(): AppConfig {
  return { ...defaultAppConfig };
}
