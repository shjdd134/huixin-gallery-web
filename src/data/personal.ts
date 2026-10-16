export const canonicalTitle = (title: string) => title.normalize('NFKC').replace(/[\\s：:。]/g, '').toLocaleLowerCase();
