const ipc = window?.electron;

export const fileJson = async (
  settings: string
): Promise<Record<string, unknown> | null> => {
  const val = await ipc?.fileJson(settings);
  return val ? JSON.parse(val) : null;
};

export default fileJson;
