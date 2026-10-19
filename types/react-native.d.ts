import React from 'react';

declare module 'react-native' {
  export const View: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const Text: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const TouchableOpacity: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const TextInput: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const ScrollView: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const Image: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const ImageBackground: React.ForwardRefExoticComponent<any> | React.FC<any>;
  export const ActivityIndicator: React.ForwardRefExoticComponent<any> | React.FC<any>;

  export const StyleSheet: {
    create<T extends Record<string, any>>(styles: T): T;
    flatten(style: any): any;
  };

  export const Linking: {
    openURL(url: string): Promise<any>;
    canOpenURL(url: string): Promise<boolean>;
  };

  export const AppRegistry: {
    registerComponent(appKey: string, getComponentFunc: () => any): void;
    getApplication(appKey: string): {
      getStyleElement: () => React.ReactElement;
      element: React.ReactElement;
    };
  };

  export type ViewStyle = any;
  export type TextStyle = any;
  export type ImageStyle = any;
  export type StyleProp<T> = any;
}
