import type { AxiosResponse } from "axios";

export const errorData = (res: AxiosResponse<any>) => {
  return {
    data: null,
    message: res.data.message,
    code: res.data.code,
  };
};
