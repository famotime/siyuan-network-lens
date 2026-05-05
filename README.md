# Network Lens

**English** · [简体中文](README_zh_CN.md)

Network Lens is a SiYuan plugin for document-level reference analytics.

It focuses on structure, evidence, and cleanup actions, not large graph rendering.

![image](https://raw.githubusercontent.com/famotime/siyuan-network-lens/main/assets/image-20260321143603-yyqht4u.quickedit-convert-webp-1774075160113-20260321143920-ed2ln0p.webp)

![image](https://raw.githubusercontent.com/famotime/siyuan-network-lens/main/assets/image-20260321143824-1lckav4.quickedit-convert-webp-1774075160589-20260321143920-v297w9q.webp)

![image](https://raw.githubusercontent.com/famotime/siyuan-network-lens/main/assets/image-20260418145347-fnrg6hk.png)

## Key Features

- Link heat ranking
- Theme community detection
- Orphan, dormant, bridge detection
- Trend analysis
- Propagation paths
- High-impact relay nodes
- Raw reference evidence
- Actionable suggestions
- Linked summary-card details
- Read / unread detection
- Theme-doc repair suggestions
- AI Inbox and LLM Wiki maintenance

## Implementation Notes

The current codebase is organized around a thin analytics state container plus focused controllers for wiki actions, document indexing, page-level filters, and setting-panel sections. The data collection layer is also split so SQL/query concerns and reference merge rules stay outside the snapshot assembly entrypoint.

## Development

- Install: `npm install --legacy-peer-deps`
- Test: `npm test`
- Build: `npm run build`

`npm run build` updates the root `package.zip`, which is expected for this plugin project.

## Usage

Feature notes, usage tips, and discussion are in the SiYuan community thread:

[We don't need a cooler graph. We need a dashboard with actions.](https://ld246.com/article/1774075839744)

