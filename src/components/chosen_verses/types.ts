export interface chosen_verse {
    reviewed: boolean;
    id: string;
    adeeb_id: string;
    is_couplet: boolean;
    verses: string[];
    poem_id: string;
    tags: string[];
    adeeb: {
        name: string;
        id: string;
    };
    poem: {
        id: string;
        intro: string;
    };
}