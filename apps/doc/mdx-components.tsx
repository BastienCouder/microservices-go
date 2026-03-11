import type { MDXComponents } from "mdx/types";
import defaultMdxComponents from "fumadocs-ui/mdx";
import * as StepsComponents from "fumadocs-ui/components/steps";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import {
  ExamplePanel,
  EndpointRow,
  EndpointTable,
  NoteBox,
  OperationHeader,
  PanelCard,
  PanelGrid,
  ReferenceAside,
  ReferenceMain,
  ReferenceShell,
  ToolCard,
  ToolGrid,
} from "@/components/docs/primitives";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...StepsComponents,
    ...TabsComponents,
    NoteBox,
    PanelGrid,
    PanelCard,
    EndpointTable,
    EndpointRow,
    ToolGrid,
    ToolCard,
    ReferenceShell,
    ReferenceMain,
    ReferenceAside,
    OperationHeader,
    ExamplePanel,
    ...components,
  };
}
