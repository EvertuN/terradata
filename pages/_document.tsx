import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';
import React from 'react';
import { AppRegistry } from 'react-native';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    AppRegistry.registerComponent('Main', () => Main);
    // @ts-ignore
    const { getStyleElement } = AppRegistry.getApplication('Main');
    const page = await ctx.renderPage();
    const styles = [
      getStyleElement(),
    ];
    return { ...page, styles: React.Children.toArray(styles) };
  }

  render() {
    return (
      <Html lang="pt-BR">
        <Head>
          <meta charSet="utf-8" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossOrigin=""
          />
          <link
            rel="icon"
            href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏙️</text></svg>"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
