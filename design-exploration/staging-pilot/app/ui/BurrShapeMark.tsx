export function BurrShapeMark({ shape }: { shape: string }) {
  const code = shape.trim().toUpperCase().replace(/^КОМБИ\s+/u, "").charAt(0);
  const paths: Record<string, string> = {
    A:"M7 5h10v14H7z",
    B:"M7 5h10v14H7z M7 5h10",
    C:"M7 8a5 5 0 0 1 10 0v11H7z",
    D:"M7 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0",
    E:"M7 12c0-5 2-8 5-8s5 3 5 8-2 8-5 8-5-3-5-8Z",
    F:"M8 19c0-7 1-12 4-15 3 3 4 8 4 15Z",
    G:"M8 19 12 4l4 15Z",
    H:"M8 19c0-7 2-11 4-15 2 4 4 8 4 15Z",
    J:"M7 19 12 5l5 14Z",
    K:"M6 19 12 6l6 13Z",
    L:"M7 19c2-5 3-10 5-15 2 5 3 10 5 15Z",
    M:"M7 19 12 5l5 14Z",
    N:"M6 5h12l-6 14Z",
    S:"M7 6h10l-2 13H9Z",
  };
  return <svg className="burr-shape-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={paths[code] ?? paths.A} /></svg>;
}
