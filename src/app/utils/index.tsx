export const formatJSON = (value: any) => {
  if (value === null || value === undefined) {
    return "NA";
  }

  return JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
    2
  );
};
