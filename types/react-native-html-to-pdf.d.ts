declare module 'react-native-html-to-pdf' {
  interface Options {
    html: string;
    fileName?: string;
    directory?: string;
    width?: number;
    height?: number;
    padding?: number;
    base64?: boolean;
    fonts?: string[];
    // Add other options as needed from the library's documentation
  }

  interface PDF {
    filePath?: string;
    base64?: string;
    numberOfPages?: number;
  }

  class RNHTMLtoPDF {
    static convert(options: Options): Promise<PDF>;
  }

  export default RNHTMLtoPDF;
}
