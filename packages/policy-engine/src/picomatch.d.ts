declare module "picomatch" {
  export default function picomatch(pattern: string): (input: string) => boolean;
}
