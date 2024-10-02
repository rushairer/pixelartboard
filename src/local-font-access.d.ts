// local-font-access.d.ts
declare global {
    interface Window {
        queryLocalFonts: () => Promise<FontData[]>
    }
}

export interface FontData {
    postscriptName: string
    fullName: string
    family: string
    style: string
    blob: () => Promise<Blob>
}
