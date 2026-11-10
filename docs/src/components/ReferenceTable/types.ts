export interface ReferenceProp {
  name: string;
  type: string;
  typeHtml: string;
  default: string | null;
  defaultHtml: string;
  description: string;
  example: string;
}

export interface ReferenceAttribute {
  name: string;
  type: string | null;
  typeHtml: string;
  description: string;
}

export interface ReferencePart {
  name: string;
  description: string;
  props: ReferenceProp[] | null;
  dataAttributes: ReferenceAttribute[] | null;
  cssVariables: ReferenceAttribute[] | null;
  sections: Array<{ label: string; html: string }>;
}
