package assistantturns

import "encoding/json"

// StoryboardContext is a bounded projection of the already persisted pre-turn
// document. It identifies positional references without copying creative text.
type StoryboardContext struct {
	Revision int64                     `json:"revision"`
	Complete bool                      `json:"complete"`
	Scripts  []StoryboardScriptContext `json:"scripts"`
}

type StoryboardScriptContext struct {
	NodeID   string   `json:"nodeId"`
	Title    string   `json:"title"`
	Selected bool     `json:"selected"`
	RowIDs   []string `json:"rowIds"`
}

// StoryboardContextForHost uses the exact Begin snapshot, even if the live
// document has since changed. It grants no additional read/write authority.
func (s *Service) StoryboardContextForHost(userID, turnID string) (StoryboardContext, error) {
	rec, err := s.load(nil, turnID)
	if err != nil {
		return StoryboardContext{}, err
	}
	if rec.UserID != userID || rec.effectiveState() != StateOpen {
		return StoryboardContext{}, errNotFound()
	}
	return storyboardContext(rec)
}

func storyboardContext(rec Record) (StoryboardContext, error) {
	var doc struct {
		Nodes []struct {
			ID       string `json:"id"`
			Type     string `json:"type"`
			Title    string `json:"title"`
			Metadata struct {
				Storyboard struct {
					Rows []struct {
						ID string `json:"id"`
					} `json:"rows"`
				} `json:"storyboard"`
			} `json:"metadata"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(rec.Document, &doc); err != nil {
		return StoryboardContext{}, err
	}
	result := StoryboardContext{Revision: rec.RevisionBefore, Complete: true, Scripts: []StoryboardScriptContext{}}
	selected := make(map[string]bool, len(rec.SelectedNodeIDs))
	for _, id := range rec.SelectedNodeIDs {
		selected[id] = true
	}
	for _, node := range doc.Nodes {
		if node.Type != "script" {
			continue
		}
		script := StoryboardScriptContext{NodeID: node.ID, Title: node.Title, Selected: selected[node.ID], RowIDs: []string{}}
		for _, row := range node.Metadata.Storyboard.Rows {
			script.RowIDs = append(script.RowIDs, row.ID)
		}
		result.Scripts = append(result.Scripts, script)
	}
	// Omit the entire order if it exceeds the prompt budget: a partial array
	// must never masquerade as a complete basis for an ordinal like “second”.
	if raw, err := json.Marshal(result); err != nil {
		return StoryboardContext{}, err
	} else if len(raw) > 24<<10 {
		result.Complete = false
		result.Scripts = []StoryboardScriptContext{}
	}
	return result, nil
}
