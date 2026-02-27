import { isString } from "lodash-es";
import { useMessage } from "@/hooks/web/useMessage";
import { checkStatus } from "./axiosStatus";
import { errorData } from "./errorConfig";
import { IAxios } from "./iAxios";
import type { AxiosInterceptor, CreateAxiosOptions } from "./axiosConfig";

const { createErrorModal, createErrorMsg } = useMessage();

/**
 * @description:一下所有拦截器请根据自身使用场景更改
 */
const interceptor: AxiosInterceptor = {
  /**
   * @description: 处理请求数据。如果数据不是预期格式，可直接抛出错误
   */
  requestHook: (res, options) => {
    /**
     * 此处方法是对请求回来的数据进行处理，
     * 根据自己的使用场景更改
     */
    const { data } = res;
    const { errorMessageMode } = options;
    if (data) {
      if (data.code === -1) {
        if (errorMessageMode === "modal") {
          createErrorModal(data.message);
        } else if (errorMessageMode === "message") {
          createErrorMsg(data.message);
        }
        return errorData(res);
      } else {
        const { code, data: dataInfo, message } = data;
        if (!code && !dataInfo && !message) {
          const toData = {
            code: 1,
            data,
            message: "ok",
          };
          return toData;
        }
      }
    }
    return data;
  },

  /**
   * @description: 请求失败的错误处理
   */
  requestCatchHook: (e, _options) => {
    return Promise.reject(e);
  },

  /**
   * @description: 请求之前处理config
   */
  beforeRequestHook: (config, options) => {
    const { urlPrefix } = options as any;
    if (urlPrefix && isString(urlPrefix)) config.url = `${urlPrefix}${config.url}`;
    return config;
  },

  /**
   * @description: 请求拦截器处理
   */
  requestInterceptors: (config) => {
    const { requestOptions } = config;
    if (requestOptions?.withToken) {
      (config as any).headers._token = "myToken";
      if (requestOptions?.specialToken)
        (config as any).headers._token = requestOptions?.specialToken;
    }

    return config;
  },

  /**
   * @description: 请求拦截器错误处理
   */
  requestInterceptorsCatch: (error) => {
    return error;
  },

  /**
   * @description: 响应拦截器处理
   */
  responseInterceptors: (res) => {
    return res;
  },

  /**
   * @description: 响应拦截器错误处理
   */
  responseInterceptorsCatch: (error: any) => {
    const { response, message, config } = error || {};
    const errorMessageMode = config.requestOptions.errorMessageMode || "none";
    checkStatus(response ? response.status : 404, message, errorMessageMode);
    return error;
  },
};

/** baseURL 由 vite.config 注入（VITE_API_BASE_URL / VITE_PTY_BASE_URL），端口不在此处参与 */
const apiBaseURL = import.meta.env?.VITE_API_BASE_URL ?? "";
const ptyBaseURL = import.meta.env?.VITE_PTY_BASE_URL ?? "";

function createAxios(opt?: Partial<CreateAxiosOptions>) {
  return new IAxios({
    ...{
      baseURL: apiBaseURL,
      timeout: 10 * 1000,
      interceptor,
      headers: { "Content-Type": "application/json" },
      requestOptions: {
        withToken: false,
        errorMessageMode: "message",
      },
    },
    ...(opt || {}),
  });
}

/** 默认请求实例，直连 langchain-serve（baseURL 由 Vite / applySidecarPorts 注入） */
export const request = createAxios();

/** PTY 服务请求实例，直连 pty-host；WebSocket 需用 new WebSocket(ptyBaseURL) */
export const ptyWs = createAxios({ baseURL: ptyBaseURL });

/** 基于 tauri-plugin-http 的封装（与 request/ptyWs 解耦），见 tauriHttp.ts */
export {
  getApiBaseUrl,
  getPtyBaseUrl,
  fetchApi,
  fetchPty,
} from "./tauriHttp";
