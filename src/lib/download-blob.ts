/**
 * Saves a Blob as a file through a temporary link, then revokes its object URL
 * so the browser does not keep the Blob until the page unloads.
 */
export const downloadBlob = (blob: Blob, name: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
