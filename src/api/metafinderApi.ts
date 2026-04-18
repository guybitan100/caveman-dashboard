import axios from "axios";

const metafinderClient = axios.create({
  baseURL: import.meta.env.VITE_SIX_METAFINDER_URL,
  timeout: 30000,
});

/**
 * MetaFinder data types - matches backend DataType enum
 */
export type MetaFinderDataType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "chat"
  | "text"
  | "url";

/**
 * Response from MetaFinder term count endpoint
 * Returns a record of values to their counts
 */
export type TermCountResponse = Record<string, number>;

/**
 * MetaFinder file item returned from /data endpoint
 */
export interface MetaFinderFile {
  presigned_url: string;
  s3_key: string;
  size: number;
  format: string;
  md5: string;
}

/**
 * Request body for fetching files from MetaFinder
 */
export interface MetaFinderDataRequest {
  data_type: MetaFinderDataType;
  count: number;
  queries: Record<string, string | number | boolean | string[]>;
}

/**
 * MetaFinder API methods
 */
export const metafinderApi = {
  /**
   * Fetch files from MetaFinder
   * POST /data
   */
  async getFiles(
    dataType: MetaFinderDataType,
    count: number = 10,
    queries: Record<string, string | number | boolean | string[]> = {}
  ): Promise<MetaFinderFile[]> {
    const request: MetaFinderDataRequest = {
      data_type: dataType,
      count,
      queries,
    };
    const response = await metafinderClient.post<MetaFinderFile[]>(
      "/data",
      request
    );
    return response.data;
  },

  /**
   * Get available formats for a data type
   * POST /count/{data_type}/term/format
   */
  async getFormats(dataType: MetaFinderDataType): Promise<string[]> {
    const response = await metafinderClient.post<TermCountResponse>(
      `/count/${dataType}/term/format`
    );
    return Object.keys(response.data).sort();
  },

  /**
   * Get available categories for a data type
   * POST /count/{data_type}/term/categories
   */
  async getCategories(dataType: MetaFinderDataType): Promise<string[]> {
    const response = await metafinderClient.post<TermCountResponse>(
      `/count/${dataType}/term/categories`
    );
    return Object.keys(response.data).sort();
  },

  /**
   * Get available languages for chat/text content
   * POST /count/chat/term/language
   */
  async getLanguages(): Promise<string[]> {
    const response = await metafinderClient.post<TermCountResponse>(
      `/count/chat/term/language`
    );
    return Object.keys(response.data).sort();
  },

  /**
   * Fetch all MetaFinder options in parallel
   * Returns organized data for all event types
   */
  async fetchAllOptions(): Promise<MetaFinderAllOptions> {
    const [
      // Formats
      imageFormats,
      audioFormats,
      videoFormats,
      documentFormats,
      // Categories
      imageCategories,
      audioCategories,
      videoCategories,
      chatCategories,
      urlCategories,
      // Languages
      languages,
    ] = await Promise.all([
      // Formats
      this.getFormats("image"),
      this.getFormats("audio"),
      this.getFormats("video"),
      this.getFormats("document"),
      // Categories
      this.getCategories("image"),
      this.getCategories("audio"),
      this.getCategories("video"),
      this.getCategories("chat"),
      this.getCategories("url"),
      // Languages
      this.getLanguages(),
    ]);

    return {
      formats: {
        image: imageFormats,
        audio: audioFormats,
        video: videoFormats,
        document: documentFormats,
      },
      categories: {
        image: imageCategories,
        audio: audioCategories,
        video: videoCategories,
        chat: chatCategories,
        url: urlCategories,
      },
      languages,
    };
  },
};

/**
 * Structure for all MetaFinder options
 */
export interface MetaFinderAllOptions {
  formats: {
    image: string[];
    audio: string[];
    video: string[];
    document: string[];
  };
  categories: {
    image: string[];
    audio: string[];
    video: string[];
    chat: string[];
    url: string[];
  };
  languages: string[];
}
